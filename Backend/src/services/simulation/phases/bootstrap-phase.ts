/**
 * Bootstrap Phase
 * 
 * Ensures required seed state exists:
 * - Truck locations initialized
 * - Batteries initialized
 * - Driver assignments initialized
 * - Initial realistic data seeded
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { SimulationContext, StationRow, TruckRow } from "../types";
import { getStationCoordinate, randomInt, round2 } from "../utils";

export async function runBootstrapPhase(context: SimulationContext): Promise<void> {
  const { stations, stationIds, timestamp } = context;

  // Ensure truck locations are initialized
  await ensureTruckLocationsInitialized(stations);

  // Ensure batteries are initialized
  await ensureSimulationBatteries(stationIds);

  // Seed initial charging sessions for CHARGING batteries
  await seedInitialChargingSessions(timestamp);

  // Ensure driver assignments are initialized
  await ensureDriverAssignments();

  // Ensure initial realistic data exists
  await ensureInitialRealisticData(stationIds, timestamp);
}

async function ensureTruckLocationsInitialized(stations: StationRow[]): Promise<void> {
  if (!stations.length) return;

  const trucksMissingLocation = await allQuery<
    Pick<TruckRow, "id" | "currentStationId" | "locationLat" | "locationLng">
  >(
    `
    SELECT id, currentStationId, locationLat, locationLng
    FROM trucks
    WHERE locationLat IS NULL OR locationLng IS NULL;
  `
  );

  for (const truck of trucksMissingLocation) {
    const stationId = truck.currentStationId ?? stations[truck.id % stations.length].id;
    const station = stations.find((item) => item.id === stationId) ?? stations[0];
    const coordinate = getStationCoordinate(station);
    await runQuery(
      "UPDATE trucks SET currentStationId = COALESCE(currentStationId, ?), locationLat = ?, locationLng = ? WHERE id = ?;",
      [station.id, coordinate.lat, coordinate.lng, truck.id]
    );
  }
}

async function ensureSimulationBatteries(stationIds: number[]): Promise<void> {
  const batteryCount = await getQuery<{ count: number }>("SELECT COUNT(*) as count FROM batteries;");
  if ((batteryCount?.count ?? 0) > 0) {
    return;
  }

  // Get station capacities to scale battery counts appropriately
  const stations = await allQuery<{ id: number; capacity: number }>(
    "SELECT id, capacity FROM stations ORDER BY id ASC;"
  );
  const stationCapacityMap = new Map(stations.map((s) => [s.id, s.capacity]));

  // Get trucks for IN_TRUCK battery assignment
  const trucks = await allQuery<{ id: number }>("SELECT id FROM trucks ORDER BY id ASC;");
  let truckIndex = 0;

  for (const stationId of stationIds) {
    const capacity = stationCapacityMap.get(stationId) ?? 20;
    
    // Scale battery counts based on station capacity for 2000 trucks:
    // Small (14-18): 150-200 batteries (up from 100-150)
    // Medium (22): 250-350 batteries (up from 200-250)
    // Large (30-40): 400-600 batteries (up from 300-400)
    // Target: 2500-3000 total batteries across all stations
    let totalBatteries: number;
    if (capacity <= 18) {
      totalBatteries = 150 + randomInt(50); // 150-200
    } else if (capacity <= 25) {
      totalBatteries = 250 + randomInt(100); // 250-350
    } else {
      totalBatteries = 400 + randomInt(200); // 400-600
    }

    // Distribution: 45% READY, 35% CHARGING, 15% IN_TRUCK, 5% MAINTENANCE
    // Ensure READY batteries are NOT consumed for IN_TRUCK assignment
    const readyCount = Math.floor(totalBatteries * 0.45);
    const chargingCount = Math.floor(totalBatteries * 0.35);
    const inTruckCount = Math.floor(totalBatteries * 0.15);
    const maintenanceCount = totalBatteries - readyCount - chargingCount - inTruckCount; // Remainder

    // Create READY batteries (SOC 80-95%) - these will NOT be converted to IN_TRUCK
    for (let i = 0; i < readyCount; i++) {
      const soc = Math.max(25, 80 + randomInt(15)); // 80-95%
      await runQuery(
        `
        INSERT INTO batteries
        (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
        VALUES (588, ?, 95, 110, 28, 'READY', ?, NULL);
      `,
        [soc, stationId]
      );
    }

    // Create CHARGING batteries (SOC 25-80%, distributed across charging progress)
    for (let i = 0; i < chargingCount; i++) {
      // Distribute SOC: some near completion (85-94%), some mid-cycle (50-80%), some newly charging (25-50%)
      let soc: number;
      const progress = Math.random();
      if (progress < 0.2) {
        // 20% near completion
        soc = Math.max(25, 85 + randomInt(10)); // 85-95%
      } else if (progress < 0.6) {
        // 40% mid-cycle
        soc = Math.max(25, 50 + randomInt(30)); // 50-80%
      } else {
        // 40% newly charging
        soc = Math.max(25, 25 + randomInt(25)); // 25-50%
      }
      await runQuery(
        `
        INSERT INTO batteries
        (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
        VALUES (588, ?, 95, 110, 28, 'CHARGING', ?, NULL);
      `,
        [soc, stationId]
      );
    }

    // Create MAINTENANCE batteries (SOC 50-80%, very small quantity)
    for (let i = 0; i < maintenanceCount; i++) {
      const soc = Math.max(25, 50 + randomInt(30)); // 50-80%
      await runQuery(
        `
        INSERT INTO batteries
        (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
        VALUES (588, ?, 92, 200, 30, 'MAINTENANCE', ?, NULL);
      `,
        [soc, stationId]
      );
    }

    // Create IN_TRUCK batteries separately (SOC 60-90%) - DO NOT convert READY batteries
    // All IN_TRUCK batteries are created new, preserving all READY batteries at stations
    for (let i = 0; i < inTruckCount; i++) {
      if (truckIndex >= trucks.length) break; // Stop if we run out of trucks
      
      const truck = trucks[truckIndex];
      truckIndex++;
      
      // Create new IN_TRUCK battery (never convert from READY)
      const soc = Math.max(25, 60 + randomInt(30)); // 60-90%
      const result = await runQuery(
        `
        INSERT INTO batteries
        (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
        VALUES (588, ?, 96, 150, 27, 'IN_TRUCK', NULL, ?);
      `,
        [soc, truck.id]
      );
      
      // Update truck with battery assignment
      await runQuery(
        `UPDATE trucks SET batteryId = ?, currentSoc = ? WHERE id = ?;`,
        [String(result.lastID), soc, truck.id]
      );
    }
  }
}

async function seedInitialChargingSessions(timestamp: string): Promise<void> {
  // Get all CHARGING batteries that don't have active sessions
  const chargingBatteries = await allQuery<{
    id: number;
    stationId: number | null;
    soc: number;
  }>(
    `
    SELECT b.id, b.stationId, b.soc
    FROM batteries b
    WHERE b.status = 'CHARGING'
      AND b.stationId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM charging_sessions cs
        WHERE cs.batteryId = b.id AND cs.status = 'ACTIVE'
      )
    ORDER BY b.id ASC;
    `
  );

  const STANDARD_BATTERY_CAPACITY_KWH = 588;
  const TARGET_SOC = 95;

  for (const battery of chargingBatteries) {
    if (!battery.stationId) continue;

    const currentSoc = battery.soc;
    
    // Distribute charging progress realistically:
    // - Near completion (85-94%): started 4-6 hours ago, startSoc around 20-30%
    // - Mid-cycle (50-80%): started 2-4 hours ago, startSoc around 15-25%
    // - Newly charging (25-50%): started 1-2 hours ago, startSoc around 20-25%
    let startSoc: number;
    let hoursAgo: number;
    
    if (currentSoc >= 85) {
      // Near completion
      startSoc = Math.max(25, 20 + randomInt(10)); // 20-30%
      hoursAgo = 4 + randomInt(2); // 4-6 hours
    } else if (currentSoc >= 50) {
      // Mid-cycle
      startSoc = Math.max(25, 15 + randomInt(10)); // 15-25%
      hoursAgo = 2 + randomInt(2); // 2-4 hours
    } else {
      // Newly charging
      startSoc = Math.max(25, 20 + randomInt(5)); // 20-25%
      hoursAgo = 1 + randomInt(1); // 1-2 hours
    }

    // Calculate energy added based on SOC difference
    const socDelta = currentSoc - startSoc;
    const energyAddedKwh = round2((STANDARD_BATTERY_CAPACITY_KWH * socDelta) / 100);

    // Set startTime to hoursAgo
    const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    // Create active charging session
    await runQuery(
      `
      INSERT INTO charging_sessions
      (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE');
    `,
      [battery.stationId, battery.id, startTime, startSoc, currentSoc, TARGET_SOC, energyAddedKwh]
    );
  }
}

async function ensureDriverAssignments(): Promise<void> {
  const unassignedDrivers = await allQuery<{
    id: number;
    fleetId: number;
    assignedTruckId: number | null;
  }>(
    "SELECT id, fleetId, assignedTruckId FROM drivers WHERE assignedTruckId IS NULL ORDER BY id ASC;"
  );

  // Only assign 60-70% of unassigned drivers (leave some for manual assignment)
  const assignCount = Math.floor(unassignedDrivers.length * (0.6 + Math.random() * 0.1));
  const driversToAssign = unassignedDrivers.slice(0, assignCount);

  for (const driver of driversToAssign) {
    const truck = await getQuery<{ id: number }>(
      "SELECT id FROM trucks WHERE fleetId = ? AND (assignedDriverId IS NULL OR assignedDriverId = 0) ORDER BY id ASC LIMIT 1;",
      [driver.fleetId]
    );
    if (!truck) {
      continue;
    }
    await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
      truck.id,
      driver.id,
    ]);
    await runQuery("UPDATE trucks SET assignedDriverId = ?, availability = 'ACTIVE', status = 'IN_TRANSIT' WHERE id = ?;", [
      driver.id,
      truck.id,
    ]);
  }
}

async function ensureInitialRealisticData(stationIds: number[], timestamp: string): Promise<void> {
  // Check if we already have swap data for today
  const swapsToday = await getQuery<{ count: number }>(
    `SELECT COUNT(*) as count FROM swap_transactions 
     WHERE date(timestamp, 'localtime') = date('now', 'localtime');`
  );

  // If no swaps today, seed initial realistic data (~1200-1500 swaps for EOD projection)
  // Target: 28M-35M ETB daily revenue (1400 swaps × 300 kWh avg × 70 ETB/kWh × 1.15 VAT ≈ 33.8M)
  if ((swapsToday?.count ?? 0) === 0) {
    const trucks = await allQuery<{ id: number; currentStationId: number | null }>(
      "SELECT id, currentStationId FROM trucks ORDER BY id ASC LIMIT 2000;"
    );

    // Create 1200-1500 swaps across different stations for today
    const swapCount = Math.min(1200 + randomInt(300), trucks.length);
    for (let i = 0; i < swapCount; i++) {
      const truck = trucks[i];
      const stationId = truck.currentStationId ?? stationIds[truck.id % stationIds.length];

      // Get real batteries for this station
      const stationBatteries = await allQuery<{ id: number }>(
        "SELECT id FROM batteries WHERE stationId = ? ORDER BY id ASC LIMIT 10;",
        [stationId]
      );

      if (stationBatteries.length < 2) continue; // Need at least 2 batteries

      const incomingBatteryId = stationBatteries[0].id;
      const outgoingBatteryId = stationBatteries[1].id;
      // Increased energy per swap: 200-400 kWh (up from 80-200 kWh) for realistic demo revenue
      const energyKwh = 200 + randomInt(200); // 200-400 kWh
      const hoursAgo = randomInt(12); // Swaps from last 12 hours
      const swapTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

      // Create swap transaction
      // Ensure arrival SOC is >= 25% (30-50% range, clamped to 25% minimum)
      const arrivalSoc = Math.max(25, 30 + randomInt(20));
      const swapInsert = await runQuery(
        `INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [truck.id, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyKwh, swapTime]
      );

      // Create receipt with random payment method
      const paymentMethods = ["Telebirr", "CBE", "M-Pesa", "Bank Transfer"];
      const paymentMethod = paymentMethods[randomInt(paymentMethods.length)];
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
        `INSERT INTO receipts
         (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, paymentMethod, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [swapInsert.lastID, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, paymentMethod, swapTime]
      );
    }

    // Create historical completed charging sessions (20-30 completed today)
    const completedSessionCount = 20 + randomInt(10);
    const chargingBatteries = await allQuery<{ id: number; stationId: number | null; soc: number }>(
      `SELECT id, stationId, soc FROM batteries 
       WHERE status = 'CHARGING' AND stationId IS NOT NULL 
       ORDER BY id ASC LIMIT ?;`,
      [completedSessionCount]
    );

    const STANDARD_BATTERY_CAPACITY_KWH = 588;
    for (let i = 0; i < Math.min(completedSessionCount, chargingBatteries.length); i++) {
      const battery = chargingBatteries[i];
      if (!battery.stationId) continue;

      // Completed session: started 3-8 hours ago, completed 1-3 hours ago
      const startHoursAgo = 3 + randomInt(5); // 3-8 hours
      const endHoursAgo = 1 + randomInt(2); // 1-3 hours
      const startTime = new Date(Date.now() - startHoursAgo * 60 * 60 * 1000).toISOString();
      const endTime = new Date(Date.now() - endHoursAgo * 60 * 60 * 1000).toISOString();

      // Start SOC: 25-40%, end SOC: 95%
      const startSoc = Math.max(25, 25 + randomInt(15));
      const endSoc = 95;
      const socDelta = endSoc - startSoc;
      const energyAddedKwh = round2((STANDARD_BATTERY_CAPACITY_KWH * socDelta) / 100);

      // Create completed session
      await runQuery(
        `INSERT INTO charging_sessions
         (stationId, batteryId, startTime, endTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED');`,
        [battery.stationId, battery.id, startTime, endTime, startSoc, endSoc, 95, energyAddedKwh]
      );
    }

    // Seed some trucks at stations (not all in transit)
    // Place 10-20% of trucks at stations
    const trucksAtStationsCount = Math.floor(trucks.length * (0.1 + Math.random() * 0.1));
    const trucksToPlace = trucks.slice(swapCount, swapCount + trucksAtStationsCount);
    
    for (const truck of trucksToPlace) {
      const stationId = stationIds[truck.id % stationIds.length];
      const station = await getQuery<{ name: string; locationLat: number | null; locationLng: number | null }>(
        "SELECT name, locationLat, locationLng FROM stations WHERE id = ?;",
        [stationId]
      );
      
      // Use station coordinates or fallback
      const coordinate = getStationCoordinate({ id: stationId, name: station?.name ?? "" });
      
      await runQuery(
        `UPDATE trucks 
         SET currentStationId = ?, status = 'READY', locationLat = ?, locationLng = ?
         WHERE id = ?;`,
        [stationId, coordinate.lat, coordinate.lng, truck.id]
      );
    }
  }
}

