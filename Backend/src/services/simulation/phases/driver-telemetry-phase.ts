/**
 * Driver Telemetry Phase
 * 
 * Handles driver telemetry updates:
 * - Speed monitoring
 * - Braking events
 * - Safety score updates
 * - Trip efficiency updates
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { DriverRow, SimulationContext } from "../types";
import { round2 } from "../utils";

export async function runDriverTelemetryPhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  // Get active drivers (those with assigned trucks)
  const activeDrivers = await allQuery<DriverRow>(
    "SELECT id, fleetId, assignedTruckId, speedViolations, harshBrakes, safetyScore, completedTrips FROM drivers WHERE assignedTruckId IS NOT NULL ORDER BY id ASC LIMIT 40;"
  );

  for (const driver of activeDrivers) {
    // Generate telemetry data
    const speed = 60 + Math.floor(Math.random() * 55); // 60-115 km/h
    const brakeForce = Number((Math.random() * 1.2).toFixed(2)); // 0-1.2

    // Record telemetry
    await runQuery(
      "INSERT INTO driver_telemetry (driverId, speed, brakeForce, timestamp) VALUES (?, ?, ?, ?);",
      [driver.id, speed, brakeForce, timestamp]
    );

    // Check for violations
    const speedViolationInc = speed > 95 ? 1 : 0;
    const harshBrakeInc = brakeForce > 0.85 ? 1 : 0;
    const safetyScoreDrop = speedViolationInc + harshBrakeInc > 0 ? 0.6 : 0;
    const nextSafety = Math.max(55, round2(driver.safetyScore - safetyScoreDrop));

    // Update driver metrics
    await runQuery(
      "UPDATE drivers SET speedViolations = speedViolations + ?, harshBrakes = harshBrakes + ?, safetyScore = ? WHERE id = ?;",
      [speedViolationInc, harshBrakeInc, nextSafety, driver.id]
    );

    // Update trip efficiency (completed trips / total assignments)
    const totalAssignments = driver.completedTrips + (driver.assignedTruckId ? 1 : 0);
    const tripEfficiency = totalAssignments > 0 ? round2(driver.completedTrips / totalAssignments) : 0;
    await runQuery("UPDATE drivers SET tripEfficiency = ? WHERE id = ?;", [tripEfficiency, driver.id]);
  }

  // Handle occasional driver detachments (5-10% chance per cycle)
  if (Math.random() < 0.08) {
    const assignedDrivers = await allQuery<DriverRow>(
      "SELECT id, fleetId, assignedTruckId FROM drivers WHERE assignedTruckId IS NOT NULL ORDER BY RANDOM() LIMIT 1;"
    );
    if (assignedDrivers.length > 0) {
      const driverToDetach = assignedDrivers[0];
      await runQuery("UPDATE drivers SET assignedTruckId = NULL, status = 'AVAILABLE' WHERE id = ?;", [
        driverToDetach.id,
      ]);
      await runQuery("UPDATE trucks SET assignedDriverId = NULL, availability = 'AVAILABLE' WHERE id = ?;", [
        driverToDetach.assignedTruckId,
      ]);
    }
  }

  // Handle new driver assignments (5-10% chance per cycle)
  if (Math.random() < 0.08) {
    const unassignedDrivers = await allQuery<DriverRow>(
      "SELECT id, fleetId, assignedTruckId FROM drivers WHERE assignedTruckId IS NULL ORDER BY id ASC LIMIT 5;"
    );

    for (const driver of unassignedDrivers.slice(0, 2)) {
      const truck = await getQuery<{ id: number }>(
        "SELECT id FROM trucks WHERE fleetId = ? AND (assignedDriverId IS NULL OR assignedDriverId = 0) ORDER BY id ASC LIMIT 1;",
        [driver.fleetId]
      );
      if (truck) {
        await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
          truck.id,
          driver.id,
        ]);
        await runQuery("UPDATE trucks SET assignedDriverId = ?, availability = 'ACTIVE' WHERE id = ?;", [
          driver.id,
          truck.id,
        ]);
      }
    }
  }
}
