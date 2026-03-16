/**
 * Simulation Orchestrator
 * 
 * Coordinates all simulation phases in the correct order.
 */

import { allQuery } from "../../database/connection";
import { scenarioService } from "../scenarios/scenario-service";
import type { SimulationContext, StationRow } from "./types";
import { runAggregateRefreshPhase } from "./phases/aggregate-refresh-phase";
import { runBatteryHealthPhase } from "./phases/battery-health-phase";
import { runBootstrapPhase } from "./phases/bootstrap-phase";
import { runChargingPhase } from "./phases/charging-phase";
import { runDriverRatingPhase } from "./phases/driver-rating-phase";
import { runDriverTelemetryPhase } from "./phases/driver-telemetry-phase";
import { runFinancePhase } from "./phases/finance-phase";
import { runFreightPhase } from "./phases/freight-phase";
import { runIncidentsFaultsPhase } from "./phases/incidents-faults-phase";
import { runLiveFeedPhase } from "./phases/live-feed-phase";
import { runMovementPhase } from "./phases/movement-phase";
import { runQueueManagementPhase } from "./phases/queue-management-phase";
import { runRefrigerationPhase } from "./phases/refrigeration-phase";
import { runStationOperationsPhase } from "./phases/station-operations-phase";

export async function runSimulationCycle(now: Date = new Date()): Promise<void> {
  const timestamp = now.toISOString();

  // Load stations
  const stations = await allQuery<StationRow>("SELECT id, name FROM stations ORDER BY id ASC;");
  const stationIds = stations.map((station) => station.id);
  const stationById = new Map(stations.map((station) => [station.id, station]));

  if (stationIds.length === 0) {
    return;
  }

  // Get scenario modifiers
  const scenarioModifiers = await scenarioService.getModifiers();

  // Create simulation context
  const context: SimulationContext = {
    timestamp,
    stations,
    stationIds,
    stationById,
    truckMotionById: new Map(),
    scenarioModifiers,
  };

  // Execute phases in order
  try {
    // Phase 1: Bootstrap - ensure required seed state exists
    await runBootstrapPhase(context);

    // Phase 2: Movement - update truck positions and SOC
    await runMovementPhase(context);

    // Phase 3: Station Operations - handle swaps and arrivals
    await runStationOperationsPhase(context);

    // Phase 4: Charging - process battery charging
    await runChargingPhase(context);

    // Phase 5: Freight - handle shipments
    await runFreightPhase(context);

    // Phase 6: Driver Telemetry - update driver metrics
    await runDriverTelemetryPhase(context);

    // Phase 7: Driver Rating - update driver ratings based on performance
    await runDriverRatingPhase(context);

    // Phase 8: Battery Health - update battery health and cycle counts
    await runBatteryHealthPhase(context);

    // Phase 9: Refrigeration - update refrigerated truck temperatures
    await runRefrigerationPhase(context);

    // Phase 10: Queue Management - manage swap queue entries
    await runQueueManagementPhase(context);

    // Phase 11: Incidents and Faults - generate incidents and faults
    await runIncidentsFaultsPhase(context);

    // Phase 12: Finance - generate receipts
    await runFinancePhase(context);

    // Phase 13: Live Feed - emit events
    await runLiveFeedPhase(context);

    // Phase 14: Aggregate Refresh - recompute aggregates if needed
    await runAggregateRefreshPhase(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation phase failed";
    console.error(`Simulation error: ${message}`, error);
    throw error;
  }
}
