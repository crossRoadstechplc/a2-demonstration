import { allQuery, getQuery, runQuery } from "../database/connection";

const SIMULATION_INTERVAL_MS = 30_000;

interface StationRow {
  id: number;
}

interface TruckRow {
  id: number;
  truckType: string;
  batteryId: string;
  status: string;
  currentSoc: number;
  refrigerationPowerDraw: number;
  currentStationId: number | null;
}

interface BatteryRow {
  id: number;
  capacityKwh: number;
  soc: number;
  status: string;
  stationId: number | null;
  truckId: number | null;
}

let simulationTimer: NodeJS.Timeout | null = null;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function findNextStationId(
  currentStationId: number | null,
  stationIds: number[]
): number {
  if (stationIds.length === 0) {
    return 0;
  }

  if (currentStationId === null) {
    return stationIds[0];
  }

  const currentIndex = stationIds.indexOf(currentStationId);
  if (currentIndex === -1) {
    return stationIds[0];
  }

  return stationIds[(currentIndex + 1) % stationIds.length];
}

async function createReceipt(swapId: number, energyKwh: number, timestamp: string): Promise<void> {
  const tariff =
    (await getQuery<{ eeuRatePerKwh: number; a2ServiceRatePerKwh: number; vatPercent: number }>(
      "SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent FROM tariff_config WHERE id = 1;"
    )) ?? { eeuRatePerKwh: 10, a2ServiceRatePerKwh: 10, vatPercent: 15 };

  const energyCharge = round2(energyKwh * tariff.eeuRatePerKwh);
  const serviceCharge = round2(energyKwh * tariff.a2ServiceRatePerKwh);
  const subtotal = round2(energyCharge + serviceCharge);
  const vat = round2(subtotal * (tariff.vatPercent / 100));
  const total = round2(subtotal + vat);
  const eeuShare = round2(energyCharge + vat / 2);
  const a2Share = round2(serviceCharge + vat / 2);

  await runQuery(
    `
    INSERT INTO receipts
    (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
    [swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, timestamp]
  );
}

async function trySwapForTruck(
  truck: TruckRow,
  stationId: number,
  outgoingBattery: BatteryRow,
  arrivalSoc: number,
  timestamp: string
): Promise<void> {
  const incomingBattery = await getQuery<BatteryRow>(
    `
    SELECT id, capacityKwh, soc, status, stationId, truckId
    FROM batteries
    WHERE stationId = ? AND status = 'READY'
    ORDER BY soc DESC, id ASC
    LIMIT 1;
  `,
    [stationId]
  );

  if (!incomingBattery) {
    return;
  }

  await runQuery(
    "UPDATE batteries SET truckId = NULL, stationId = ?, soc = ?, status = 'CHARGING' WHERE id = ?;",
    [stationId, arrivalSoc, outgoingBattery.id]
  );

  await runQuery(
    "UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK' WHERE id = ?;",
    [truck.id, incomingBattery.id]
  );

  const extraEnergy =
    truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
  const energyDeliveredKwh = round2(
    Math.max(
      0,
      (incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100 + extraEnergy
    )
  );

  await runQuery("UPDATE trucks SET batteryId = ?, currentSoc = ? WHERE id = ?;", [
    String(incomingBattery.id),
    incomingBattery.soc,
    truck.id
  ]);

  const swapInsert = await runQuery(
    `
    INSERT INTO swap_transactions
    (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,
    [
      truck.id,
      stationId,
      incomingBattery.id,
      outgoingBattery.id,
      arrivalSoc,
      energyDeliveredKwh,
      timestamp
    ]
  );

  await createReceipt(swapInsert.lastID, energyDeliveredKwh, timestamp);
}

async function processOvernightCharging(timestamp: string): Promise<void> {
  const batteriesToCharge = await allQuery<BatteryRow>(
    `
    SELECT id, capacityKwh, soc, status, stationId, truckId
    FROM batteries
    WHERE stationId IS NOT NULL AND status = 'READY' AND soc < 95;
  `
  );

  for (const battery of batteriesToCharge) {
    const activeSession = await getQuery<{ id: number }>(
      "SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
      [battery.id]
    );

    if (!activeSession) {
      await runQuery(
        `
        INSERT INTO charging_sessions (stationId, batteryId, startTime, energyAddedKwh, status)
        VALUES (?, ?, ?, 0, 'ACTIVE');
      `,
        [battery.stationId ?? 0, battery.id, timestamp]
      );
      await runQuery("UPDATE batteries SET status = 'CHARGING' WHERE id = ?;", [battery.id]);
    }
  }

  const activeSessions = await allQuery<{ id: number; batteryId: number; energyAddedKwh: number }>(
    "SELECT id, batteryId, energyAddedKwh FROM charging_sessions WHERE status = 'ACTIVE';"
  );

  for (const session of activeSessions) {
    const battery = await getQuery<BatteryRow>(
      "SELECT id, capacityKwh, soc, status, stationId, truckId FROM batteries WHERE id = ?;",
      [session.batteryId]
    );
    if (!battery) {
      continue;
    }

    const nextSoc = Math.min(100, round2(battery.soc + 10));
    const addedKwh = round2((battery.capacityKwh * (nextSoc - battery.soc)) / 100);
    const totalAddedKwh = round2(session.energyAddedKwh + addedKwh);

    await runQuery("UPDATE batteries SET soc = ? WHERE id = ?;", [nextSoc, battery.id]);

    if (nextSoc >= 95) {
      await runQuery(
        `
        UPDATE charging_sessions
        SET endTime = ?, energyAddedKwh = ?, status = 'COMPLETED'
        WHERE id = ?;
      `,
        [timestamp, totalAddedKwh, session.id]
      );
      await runQuery("UPDATE batteries SET status = 'READY' WHERE id = ?;", [battery.id]);
      continue;
    }

    await runQuery("UPDATE charging_sessions SET energyAddedKwh = ? WHERE id = ?;", [
      totalAddedKwh,
      session.id
    ]);
  }
}

export async function runSimulationCycle(now: Date = new Date()): Promise<void> {
  const timestamp = now.toISOString();
  const stations = await allQuery<StationRow>("SELECT id FROM stations ORDER BY id ASC;");
  const stationIds = stations.map((station) => station.id);
  if (stationIds.length === 0) {
    return;
  }

  const trucks = await allQuery<TruckRow>("SELECT * FROM trucks ORDER BY id ASC;");

  for (const truck of trucks) {
    if (truck.status === "READY") {
      await runQuery("UPDATE trucks SET status = 'IN_TRANSIT' WHERE id = ?;", [truck.id]);
      continue;
    }

    if (truck.status !== "IN_TRANSIT") {
      continue;
    }

    const destinationStationId = findNextStationId(truck.currentStationId, stationIds);
    const truckBattery = await getQuery<BatteryRow>(
      `
      SELECT id, capacityKwh, soc, status, stationId, truckId
      FROM batteries
      WHERE truckId = ?
      ORDER BY id ASC
      LIMIT 1;
    `,
      [truck.id]
    );

    if (truckBattery) {
      const baseDrop = 10;
      const extraDrop = truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
      const newSoc = round2(Math.max(0, truckBattery.soc - (baseDrop + extraDrop)));

      await runQuery("UPDATE batteries SET soc = ? WHERE id = ?;", [newSoc, truckBattery.id]);
      await runQuery("UPDATE trucks SET currentSoc = ? WHERE id = ?;", [newSoc, truck.id]);

      if (newSoc < 20) {
        await trySwapForTruck(truck, destinationStationId, truckBattery, newSoc, timestamp);
      }
    }

    await runQuery("UPDATE trucks SET status = 'READY', currentStationId = ? WHERE id = ?;", [
      destinationStationId,
      truck.id
    ]);
  }

  const hour = now.getHours();
  if (hour >= 20 || hour < 6) {
    await processOvernightCharging(timestamp);
  }
}

export function isSimulationRunning(): boolean {
  return simulationTimer !== null;
}

export function startSimulation(): boolean {
  if (simulationTimer) {
    return false;
  }

  simulationTimer = setInterval(() => {
    void runSimulationCycle().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Simulation cycle failed";
      console.error(message);
    });
  }, SIMULATION_INTERVAL_MS);

  return true;
}

export function stopSimulation(): boolean {
  if (!simulationTimer) {
    return false;
  }

  clearInterval(simulationTimer);
  simulationTimer = null;
  return true;
}
