/**
 * Station Operations Phase
 * 
 * Handles station-level operations:
 * - Queue evaluation
 * - Truck arrivals
 * - Swap eligibility checks
 * - Swap processing
 * - Battery reassignment
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { BatteryRow, SimulationContext, TruckRow } from "../types";
import { round2 } from "../utils";

export async function runStationOperationsPhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  // Get all trucks that have arrived at stations (progress >= 1)
  const trucks = await allQuery<TruckRow>(
    `
    SELECT t.id, t.truckType, t.batteryId, t.status, t.currentSoc, t.refrigerationPowerDraw, 
           t.currentStationId, t.locationLat, t.locationLng, t.assignedDriverId
    FROM trucks t
    WHERE t.status = 'READY' AND t.currentStationId IS NOT NULL;
    `
  );

  for (const truck of trucks) {
    if (!truck.currentStationId) {
      continue;
    }

    // Get truck's current battery
    const outgoingBattery = await getQuery<BatteryRow>(
      `
      SELECT id, capacityKwh, soc, status, stationId, truckId
      FROM batteries
      WHERE truckId = ?
      ORDER BY id ASC
      LIMIT 1;
    `,
      [truck.id]
    );

    if (!outgoingBattery) {
      continue;
    }

    // Enforce 25% SOC minimum floor - clamp arrival SOC if it's below 25%
    let arrivalSoc = Math.max(25, truck.currentSoc);

    // Check swap eligibility: SOC < 35 (always swap) or SOC < 45 (70% chance)
    // Trucks should swap before hitting 25% floor
    // Apply scenario modifier for swap frequency
    const swapFrequencyMultiplier = context.scenarioModifiers.swapFrequencyMultiplier ?? 1.0;
    const swapProbability = 0.7 * swapFrequencyMultiplier;
    const shouldSwap = arrivalSoc < 35 || (arrivalSoc < 45 && Math.random() < Math.min(1.0, swapProbability));

    // Check if station is targeted by scenario
    const targetStationIds = context.scenarioModifiers.targetStationIds;
    const isTargetStation = !targetStationIds || targetStationIds.length === 0 || targetStationIds.includes(truck.currentStationId);

    if (shouldSwap && isTargetStation) {
      await trySwapForTruck(truck, truck.currentStationId, outgoingBattery, arrivalSoc, timestamp, context);
    } else if (shouldSwap) {
      await trySwapForTruck(truck, truck.currentStationId, outgoingBattery, arrivalSoc, timestamp, context);
    }
  }
}

async function trySwapForTruck(
  truck: TruckRow,
  stationId: number,
  outgoingBattery: BatteryRow,
  arrivalSoc: number,
  timestamp: string,
  context: SimulationContext
): Promise<void> {
  // Apply scenario modifier for ready battery availability
  const availabilityMultiplier = context.scenarioModifiers.readyBatteryAvailabilityMultiplier ?? 1.0;
  
  // Find highest SOC READY battery at station
  // If availability is reduced, we might need to check more batteries or reduce chance
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

  // If availability multiplier < 1.0, reduce chance of finding battery
  if (incomingBattery && availabilityMultiplier < 1.0 && Math.random() > availabilityMultiplier) {
    return; // Simulate reduced battery availability
  }

  if (!incomingBattery) {
    return; // No battery available
  }

  // Update outgoing battery: move to station, set to CHARGING
  // Increment cycle count when battery is swapped out
  // Ensure arrival SOC respects 25% floor
  const clampedArrivalSoc = Math.max(25, arrivalSoc);
  await runQuery(
    "UPDATE batteries SET truckId = NULL, stationId = ?, soc = ?, status = 'CHARGING', cycleCount = cycleCount + 1 WHERE id = ?;",
    [stationId, clampedArrivalSoc, outgoingBattery.id]
  );

  // Update incoming battery: move to truck, set to IN_TRUCK
  await runQuery(
    "UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK' WHERE id = ?;",
    [truck.id, incomingBattery.id]
  );

  // Calculate energy delivered
  const extraEnergy = truck.truckType === "REFRIGERATED" ? truck.refrigerationPowerDraw : 0;
  const energyDeliveredKwh = round2(
    Math.max(
      0,
      (incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100 + extraEnergy
    )
  );

  // Update truck battery and SOC
  await runQuery("UPDATE trucks SET batteryId = ?, currentSoc = ? WHERE id = ?;", [
    String(incomingBattery.id),
    incomingBattery.soc,
    truck.id,
  ]);

  // Create swap transaction
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
      timestamp,
    ]
  );

  // Receipt will be created in finance phase
  // Store swap ID for finance phase to process
}
