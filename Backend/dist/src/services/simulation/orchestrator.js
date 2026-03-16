"use strict";
/**
 * Simulation Orchestrator
 *
 * Coordinates all simulation phases in the correct order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSimulationCycle = runSimulationCycle;
const connection_1 = require("../../database/connection");
const scenario_service_1 = require("../scenarios/scenario-service");
const aggregate_refresh_phase_1 = require("./phases/aggregate-refresh-phase");
const battery_health_phase_1 = require("./phases/battery-health-phase");
const bootstrap_phase_1 = require("./phases/bootstrap-phase");
const charging_phase_1 = require("./phases/charging-phase");
const driver_rating_phase_1 = require("./phases/driver-rating-phase");
const driver_telemetry_phase_1 = require("./phases/driver-telemetry-phase");
const finance_phase_1 = require("./phases/finance-phase");
const freight_phase_1 = require("./phases/freight-phase");
const incidents_faults_phase_1 = require("./phases/incidents-faults-phase");
const live_feed_phase_1 = require("./phases/live-feed-phase");
const movement_phase_1 = require("./phases/movement-phase");
const queue_management_phase_1 = require("./phases/queue-management-phase");
const refrigeration_phase_1 = require("./phases/refrigeration-phase");
const station_operations_phase_1 = require("./phases/station-operations-phase");
async function runSimulationCycle(now = new Date()) {
    const timestamp = now.toISOString();
    // Load stations
    const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
    const stationIds = stations.map((station) => station.id);
    const stationById = new Map(stations.map((station) => [station.id, station]));
    if (stationIds.length === 0) {
        return;
    }
    // Get scenario modifiers
    const scenarioModifiers = await scenario_service_1.scenarioService.getModifiers();
    // Create simulation context
    const context = {
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
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        // Phase 2: Movement - update truck positions and SOC
        await (0, movement_phase_1.runMovementPhase)(context);
        // Phase 3: Station Operations - handle swaps and arrivals
        await (0, station_operations_phase_1.runStationOperationsPhase)(context);
        // Phase 4: Charging - process battery charging
        await (0, charging_phase_1.runChargingPhase)(context);
        // Phase 5: Freight - handle shipments
        await (0, freight_phase_1.runFreightPhase)(context);
        // Phase 6: Driver Telemetry - update driver metrics
        await (0, driver_telemetry_phase_1.runDriverTelemetryPhase)(context);
        // Phase 7: Driver Rating - update driver ratings based on performance
        await (0, driver_rating_phase_1.runDriverRatingPhase)(context);
        // Phase 8: Battery Health - update battery health and cycle counts
        await (0, battery_health_phase_1.runBatteryHealthPhase)(context);
        // Phase 9: Refrigeration - update refrigerated truck temperatures
        await (0, refrigeration_phase_1.runRefrigerationPhase)(context);
        // Phase 10: Queue Management - manage swap queue entries
        await (0, queue_management_phase_1.runQueueManagementPhase)(context);
        // Phase 11: Incidents and Faults - generate incidents and faults
        await (0, incidents_faults_phase_1.runIncidentsFaultsPhase)(context);
        // Phase 12: Finance - generate receipts
        await (0, finance_phase_1.runFinancePhase)(context);
        // Phase 13: Live Feed - emit events
        await (0, live_feed_phase_1.runLiveFeedPhase)(context);
        // Phase 14: Aggregate Refresh - recompute aggregates if needed
        await (0, aggregate_refresh_phase_1.runAggregateRefreshPhase)(context);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Simulation phase failed";
        console.error(`Simulation error: ${message}`, error);
        throw error;
    }
}
