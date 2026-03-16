/**
 * Charging Phase
 * 
 * Handles battery charging:
 * - Charging window evaluation
 * - Charging session lifecycle
 * - Battery SOC increase
 * - Energy added tracking
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { BatteryRow, SimulationContext } from "../types";
import { round2 } from "../utils";

const STANDARD_BATTERY_CAPACITY_KWH = 588;
const CHARGER_OUTPUT_KW = 50; // Standard charger output
const CHARGER_EFFICIENCY = 0.95; // 95% efficiency

export async function runChargingPhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  const now = new Date(timestamp);
  const hour = now.getHours();

  // Get charging window config
  const window = await getQuery<{ startHour: number; endHour: number }>(
    `SELECT startHour, endHour FROM charging_window_config WHERE id = 1;`
  ) ?? { startHour: 22, endHour: 6 };

  // Check if we're in charging window
  const inWindow = window.startHour <= window.endHour
    ? hour >= window.startHour && hour < window.endHour
    : hour >= window.startHour || hour < window.endHour;

  // Respect charging window (but allow some flexibility for demo)
  // During demo, allow charging outside window at reduced rate (50% of normal)
  const shouldCharge = inWindow;
  const chargeRateMultiplier = inWindow ? 1.0 : 0.5; // Reduced rate outside window

  // Get station charger capacity constraints
  const stationCapacities = await getStationChargerCapacities();

  // Apply scenario modifier for charger availability
  const chargerAvailabilityMultiplier = context.scenarioModifiers.chargerAvailabilityMultiplier ?? 1.0;
  for (const [stationId, capacity] of stationCapacities.entries()) {
    stationCapacities.set(stationId, Math.floor(capacity * chargerAvailabilityMultiplier));
  }

  // Note: We always allow charging (even outside window at reduced rate), so no early return needed

  // Find batteries that need charging (only during window or demo mode)
  const batteriesToCharge = await allQuery<BatteryRow>(
    `
    SELECT id, capacityKwh, soc, status, stationId, truckId
    FROM batteries
    WHERE stationId IS NOT NULL 
      AND status != 'MAINTENANCE'
      AND ((status = 'CHARGING') OR (status = 'READY' AND soc < 95))
      AND soc < 95;
    `
  );

  // Group batteries by station to respect charger capacity
  const batteriesByStation = new Map<number, BatteryRow[]>();
  for (const battery of batteriesToCharge) {
    if (!battery.stationId) continue;
    const stationBatteries = batteriesByStation.get(battery.stationId) ?? [];
    stationBatteries.push(battery);
    batteriesByStation.set(battery.stationId, stationBatteries);
  }

  // Create charging sessions for batteries that need them (respecting capacity)
  for (const [stationId, stationBatteries] of batteriesByStation) {
    const maxChargers = stationCapacities.get(stationId) ?? 20; // Default 20 chargers per station
    
    // Count active charging sessions at this station
    const activeCount = await getQuery<{ count: number }>(
      "SELECT COUNT(*) as count FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';",
      [stationId]
    );
    const availableSlots = Math.max(0, maxChargers - (activeCount?.count ?? 0));

    // Start charging for batteries that need it (up to available slots)
    for (let i = 0; i < Math.min(availableSlots, stationBatteries.length); i++) {
      const battery = stationBatteries[i];
      
      const activeSession = await getQuery<{ id: number }>(
        "SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
        [battery.id]
      );

      if (!activeSession && battery.status !== 'CHARGING') {
        await runQuery(
          `
          INSERT INTO charging_sessions (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status)
          VALUES (?, ?, ?, ?, ?, 95, 0, 'ACTIVE');
        `,
          [battery.stationId ?? 0, battery.id, timestamp, battery.soc, battery.soc]
        );
        await runQuery("UPDATE batteries SET status = 'CHARGING' WHERE id = ?;", [battery.id]);
      }
    }
  }

  // Update active charging sessions with realistic charging rates
  const activeSessions = await allQuery<{
    id: number;
    batteryId: number;
    stationId: number;
    startSoc: number;
    currentSoc: number;
    targetSoc: number;
    energyAddedKwh: number;
  }>(
    "SELECT id, batteryId, stationId, startSoc, currentSoc, targetSoc, energyAddedKwh FROM charging_sessions WHERE status = 'ACTIVE';"
  );

  // Calculate time delta (simulation cycle is ~10 seconds)
  const cycleTimeHours = 10 / 3600; // 10 seconds in hours

  for (const session of activeSessions) {
    const battery = await getQuery<BatteryRow>(
      "SELECT id, capacityKwh, soc, status, stationId, truckId FROM batteries WHERE id = ?;",
      [session.batteryId]
    );
    if (!battery || battery.status !== 'CHARGING') {
      continue;
    }

    // Realistic charging: 50 kW charger output, 95% efficiency
    // Energy added per cycle = charger output * time * efficiency
    // Apply scenario modifier for charging rate
    const chargingRateMultiplierScenario = context.scenarioModifiers.chargingRateMultiplier ?? 1.0;
    const energyAddedThisCycle = round2(
      CHARGER_OUTPUT_KW * cycleTimeHours * CHARGER_EFFICIENCY * chargeRateMultiplier * chargingRateMultiplierScenario
    );
    
    // Convert energy to SOC increase
    const socIncrease = round2((energyAddedThisCycle / STANDARD_BATTERY_CAPACITY_KWH) * 100);
    const nextSoc = Math.min(session.targetSoc, round2(battery.soc + socIncrease));
    const actualEnergyAdded = round2((STANDARD_BATTERY_CAPACITY_KWH * (nextSoc - battery.soc)) / 100);
    const totalAddedKwh = round2(session.energyAddedKwh + actualEnergyAdded);

    // Update battery SOC
    await runQuery("UPDATE batteries SET soc = ? WHERE id = ?;", [nextSoc, battery.id]);

    // Check if charging complete
    if (nextSoc >= session.targetSoc || nextSoc >= 95) {
      await runQuery(
        `
        UPDATE charging_sessions
        SET endTime = ?, currentSoc = ?, energyAddedKwh = ?, status = 'COMPLETED'
        WHERE id = ?;
      `,
        [timestamp, nextSoc, totalAddedKwh, session.id]
      );
      await runQuery("UPDATE batteries SET status = 'READY' WHERE id = ?;", [battery.id]);
    } else {
      // Update session progress
      await runQuery(
        "UPDATE charging_sessions SET currentSoc = ?, energyAddedKwh = ? WHERE id = ?;",
        [nextSoc, totalAddedKwh, session.id]
      );
    }
  }
}

async function getStationChargerCapacities(): Promise<Map<number, number>> {
  // Calculate realistic charger capacity per station based on battery count and station size
  // Rule: ~1 charger per 3.5 batteries (realistic ratio)
  // Scaled for 1000 trucks: small stations max 50, medium max 100, large max 150
  const stations = await allQuery<{ id: number; capacity: number }>(
    "SELECT id, capacity FROM stations WHERE status = 'ACTIVE';"
  );

  const capacities = new Map<number, number>();
  for (const station of stations) {
    const batteryCount = await getQuery<{ count: number }>(
      "SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;",
      [station.id]
    );
    const batteryCountValue = batteryCount?.count ?? station.capacity;
    
    // Determine max chargers based on station capacity (size)
    let maxChargers: number;
    if (station.capacity <= 18) {
      maxChargers = 50; // Small stations
    } else if (station.capacity <= 25) {
      maxChargers = 100; // Medium stations
    } else {
      maxChargers = 150; // Large stations
    }
    
    // Calculate chargers: 1 per 3.5 batteries, min 10, max based on station size
    const chargerCount = Math.max(10, Math.min(maxChargers, Math.ceil(batteryCountValue / 3.5)));
    capacities.set(station.id, chargerCount);
  }

  return capacities;
}
