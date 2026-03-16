/**
 * Driver Rating Phase
 * 
 * Updates driver ratings based on performance:
 * - Calculates overallRating from completedTrips and safetyScore
 * - Updates tripEfficiency
 */

import { allQuery, runQuery } from "../../../database/connection";
import type { SimulationContext } from "../types";
import { round2 } from "../utils";

export async function runDriverRatingPhase(context: SimulationContext): Promise<void> {
  // Get all drivers
  const drivers = await allQuery<{
    id: number;
    completedTrips: number;
    safetyScore: number;
    assignedTruckId: number | null;
    overallRating: number;
  }>(
    "SELECT id, completedTrips, safetyScore, assignedTruckId, overallRating FROM drivers;"
  );

  for (const driver of drivers) {
    // Calculate overall rating based on:
    // - Completed trips (more trips = higher base rating, max 3.5)
    // - Safety score (higher safety = higher rating, max 1.5)
    const tripComponent = Math.min(3.5, 2.0 + (driver.completedTrips / 100) * 1.5);
    const safetyComponent = Math.min(1.5, (driver.safetyScore / 100) * 1.5);
    const newRating = round2(Math.max(0, Math.min(5, tripComponent + safetyComponent)));

    // Calculate trip efficiency
    const activeAssignments = driver.assignedTruckId ? 1 : 0;
    const totalAssignments = driver.completedTrips + activeAssignments;
    const tripEfficiency = totalAssignments > 0 ? round2(driver.completedTrips / totalAssignments) : 0;

    await runQuery(
      "UPDATE drivers SET overallRating = ?, tripEfficiency = ? WHERE id = ?;",
      [newRating, tripEfficiency, driver.id]
    );
  }
}
