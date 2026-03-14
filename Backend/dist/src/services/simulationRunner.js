"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSimulationCycle = runSimulationCycle;
exports.isSimulationRunning = isSimulationRunning;
exports.startSimulation = startSimulation;
exports.stopSimulation = stopSimulation;
const connection_1 = require("../database/connection");
const SIMULATION_INTERVAL_MS = 30000;
let simulationTimer = null;
function round2(value) {
    return Number(value.toFixed(2));
}
function findNextStationId(currentStationId, stationIds) {
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
async function createReceipt(swapId, energyKwh, timestamp) {
    const tariff = (await (0, connection_1.getQuery)("SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent FROM tariff_config WHERE id = 1;")) ?? { eeuRatePerKwh: 10, a2ServiceRatePerKwh: 10, vatPercent: 15 };
    const energyCharge = round2(energyKwh * tariff.eeuRatePerKwh);
    const serviceCharge = round2(energyKwh * tariff.a2ServiceRatePerKwh);
    const subtotal = round2(energyCharge + serviceCharge);
    const vat = round2(subtotal * (tariff.vatPercent / 100));
    const total = round2(subtotal + vat);
    const eeuShare = round2(energyCharge + vat / 2);
    const a2Share = round2(serviceCharge + vat / 2);
    await (0, connection_1.runQuery)(`
    INSERT INTO receipts
    (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `, [swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, timestamp]);
}
async function trySwapForTruck(truck, stationId, outgoingBattery, arrivalSoc, timestamp) {
    const incomingBattery = await (0, connection_1.getQuery)(`
    SELECT id, capacityKwh, soc, status, stationId, truckId
    FROM batteries
    WHERE stationId = ? AND status = 'READY'
    ORDER BY soc DESC, id ASC
    LIMIT 1;
  `, [stationId]);
    if (!incomingBattery) {
        return;
    }
    await (0, connection_1.runQuery)("UPDATE batteries SET truckId = NULL, stationId = ?, soc = ?, status = 'CHARGING' WHERE id = ?;", [stationId, arrivalSoc, outgoingBattery.id]);
    await (0, connection_1.runQuery)("UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK' WHERE id = ?;", [truck.id, incomingBattery.id]);
    const extraEnergy = truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
    const energyDeliveredKwh = round2(Math.max(0, (incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100 + extraEnergy));
    await (0, connection_1.runQuery)("UPDATE trucks SET batteryId = ?, currentSoc = ? WHERE id = ?;", [
        String(incomingBattery.id),
        incomingBattery.soc,
        truck.id
    ]);
    const swapInsert = await (0, connection_1.runQuery)(`
    INSERT INTO swap_transactions
    (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `, [
        truck.id,
        stationId,
        incomingBattery.id,
        outgoingBattery.id,
        arrivalSoc,
        energyDeliveredKwh,
        timestamp
    ]);
    await createReceipt(swapInsert.lastID, energyDeliveredKwh, timestamp);
}
async function processOvernightCharging(timestamp) {
    const batteriesToCharge = await (0, connection_1.allQuery)(`
    SELECT id, capacityKwh, soc, status, stationId, truckId
    FROM batteries
    WHERE stationId IS NOT NULL AND status = 'READY' AND soc < 95;
  `);
    for (const battery of batteriesToCharge) {
        const activeSession = await (0, connection_1.getQuery)("SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';", [battery.id]);
        if (!activeSession) {
            await (0, connection_1.runQuery)(`
        INSERT INTO charging_sessions (stationId, batteryId, startTime, energyAddedKwh, status)
        VALUES (?, ?, ?, 0, 'ACTIVE');
      `, [battery.stationId ?? 0, battery.id, timestamp]);
            await (0, connection_1.runQuery)("UPDATE batteries SET status = 'CHARGING' WHERE id = ?;", [battery.id]);
        }
    }
    const activeSessions = await (0, connection_1.allQuery)("SELECT id, batteryId, energyAddedKwh FROM charging_sessions WHERE status = 'ACTIVE';");
    for (const session of activeSessions) {
        const battery = await (0, connection_1.getQuery)("SELECT id, capacityKwh, soc, status, stationId, truckId FROM batteries WHERE id = ?;", [session.batteryId]);
        if (!battery) {
            continue;
        }
        const nextSoc = Math.min(100, round2(battery.soc + 10));
        const addedKwh = round2((battery.capacityKwh * (nextSoc - battery.soc)) / 100);
        const totalAddedKwh = round2(session.energyAddedKwh + addedKwh);
        await (0, connection_1.runQuery)("UPDATE batteries SET soc = ? WHERE id = ?;", [nextSoc, battery.id]);
        if (nextSoc >= 95) {
            await (0, connection_1.runQuery)(`
        UPDATE charging_sessions
        SET endTime = ?, energyAddedKwh = ?, status = 'COMPLETED'
        WHERE id = ?;
      `, [timestamp, totalAddedKwh, session.id]);
            await (0, connection_1.runQuery)("UPDATE batteries SET status = 'READY' WHERE id = ?;", [battery.id]);
            continue;
        }
        await (0, connection_1.runQuery)("UPDATE charging_sessions SET energyAddedKwh = ? WHERE id = ?;", [
            totalAddedKwh,
            session.id
        ]);
    }
}
async function runSimulationCycle(now = new Date()) {
    const timestamp = now.toISOString();
    const stations = await (0, connection_1.allQuery)("SELECT id FROM stations ORDER BY id ASC;");
    const stationIds = stations.map((station) => station.id);
    if (stationIds.length === 0) {
        return;
    }
    const trucks = await (0, connection_1.allQuery)("SELECT * FROM trucks ORDER BY id ASC;");
    for (const truck of trucks) {
        if (truck.status === "READY") {
            await (0, connection_1.runQuery)("UPDATE trucks SET status = 'IN_TRANSIT' WHERE id = ?;", [truck.id]);
            continue;
        }
        if (truck.status !== "IN_TRANSIT") {
            continue;
        }
        const destinationStationId = findNextStationId(truck.currentStationId, stationIds);
        const truckBattery = await (0, connection_1.getQuery)(`
      SELECT id, capacityKwh, soc, status, stationId, truckId
      FROM batteries
      WHERE truckId = ?
      ORDER BY id ASC
      LIMIT 1;
    `, [truck.id]);
        if (truckBattery) {
            const baseDrop = 10;
            const extraDrop = truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
            const newSoc = round2(Math.max(0, truckBattery.soc - (baseDrop + extraDrop)));
            await (0, connection_1.runQuery)("UPDATE batteries SET soc = ? WHERE id = ?;", [newSoc, truckBattery.id]);
            await (0, connection_1.runQuery)("UPDATE trucks SET currentSoc = ? WHERE id = ?;", [newSoc, truck.id]);
            if (newSoc < 20) {
                await trySwapForTruck(truck, destinationStationId, truckBattery, newSoc, timestamp);
            }
        }
        await (0, connection_1.runQuery)("UPDATE trucks SET status = 'READY', currentStationId = ? WHERE id = ?;", [
            destinationStationId,
            truck.id
        ]);
    }
    const hour = now.getHours();
    if (hour >= 20 || hour < 6) {
        await processOvernightCharging(timestamp);
    }
}
function isSimulationRunning() {
    return simulationTimer !== null;
}
function startSimulation() {
    if (simulationTimer) {
        return false;
    }
    simulationTimer = setInterval(() => {
        void runSimulationCycle().catch((error) => {
            const message = error instanceof Error ? error.message : "Simulation cycle failed";
            console.error(message);
        });
    }, SIMULATION_INTERVAL_MS);
    return true;
}
function stopSimulation() {
    if (!simulationTimer) {
        return false;
    }
    clearInterval(simulationTimer);
    simulationTimer = null;
    return true;
}
