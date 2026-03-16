/**
 * Refrigeration Phase
 * 
 * Simulates refrigerated truck temperature:
 * - Updates temperatureCurrent based on target
 * - Simulates temperature drift
 * - Updates power draw if needed
 */

import { allQuery, runQuery } from "../../../database/connection";
import type { SimulationContext } from "../types";
import { round2 } from "../utils";

export async function runRefrigerationPhase(context: SimulationContext): Promise<void> {
  // Get all refrigerated trucks
  const refrigeratedTrucks = await allQuery<{
    id: number;
    temperatureTarget: number | null;
    temperatureCurrent: number | null;
    refrigerationPowerDraw: number;
    status: string;
  }>(
    `
    SELECT id, temperatureTarget, temperatureCurrent, refrigerationPowerDraw, status
    FROM trucks
    WHERE truckType = 'REFRIGERATED'
      AND temperatureTarget IS NOT NULL
      AND temperatureCurrent IS NOT NULL;
    `
  );

  for (const truck of refrigeratedTrucks) {
    if (!truck.temperatureTarget || truck.temperatureCurrent === null) {
      continue;
    }

    // Only update temperature for active trucks
    if (truck.status !== "IN_TRANSIT" && truck.status !== "READY") {
      continue;
    }

    // Simulate temperature drift toward target
    // Temperature moves 0.1-0.3°C per cycle toward target
    const diff = truck.temperatureTarget - truck.temperatureCurrent;
    const drift = Math.sign(diff) * (0.1 + Math.random() * 0.2);
    const newTemp = round2(Math.max(-10, Math.min(10, truck.temperatureCurrent + drift)));

    // Add some random variation (±0.2°C)
    const finalTemp = round2(newTemp + (Math.random() - 0.5) * 0.4);

    await runQuery("UPDATE trucks SET temperatureCurrent = ? WHERE id = ?;", [finalTemp, truck.id]);
  }
}
