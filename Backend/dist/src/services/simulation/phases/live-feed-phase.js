"use strict";
/**
 * Live Feed Phase
 *
 * Emits recent events for dashboards:
 * - Swap completions
 * - Truck arrivals
 * - Incident creation
 * - Charging session start/complete
 * - Shipment status transitions
 * - Driver-truck assignments/detachments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLiveFeedPhase = runLiveFeedPhase;
const connection_1 = require("../../../database/connection");
async function runLiveFeedPhase(context) {
    const { timestamp } = context;
    // Record all live feed events for dashboards
    await recordTruckArrivals(timestamp);
    await recordSwapCompletions(timestamp);
    await recordChargingEvents(timestamp);
    await recordShipmentEvents(timestamp);
    await recordDriverAssignments(timestamp);
    await recordIncidents(timestamp);
    await recordChargerFaults(timestamp);
    // Note: Live feed events are stored in various tables and queried on-demand by dashboard endpoints
}
async function recordTruckArrivals(timestamp) {
    // Find trucks that just arrived at stations (status changed to READY with currentStationId)
    const newArrivals = await (0, connection_1.allQuery)(`
    SELECT t.id as truckId, t.assignedDriverId as driverId, t.currentStationId as stationId
    FROM trucks t
    WHERE t.status = 'READY'
      AND t.currentStationId IS NOT NULL
      AND t.assignedDriverId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM truck_arrivals ta
        WHERE ta.truckId = t.id
          AND ta.stationId = t.currentStationId
          AND ta.arrivedAt >= datetime('now', '-10 seconds')
      );
    `);
    for (const arrival of newArrivals) {
        if (!arrival.driverId)
            continue;
        await (0, connection_1.runQuery)("INSERT INTO truck_arrivals (stationId, truckId, driverId, arrivedAt) VALUES (?, ?, ?, ?);", [arrival.stationId, arrival.truckId, arrival.driverId, timestamp]);
    }
}
async function recordSwapCompletions(timestamp) {
    // Swaps are already recorded in swap_transactions table
    // This is handled by station-operations-phase
    // No additional recording needed here
}
async function recordChargingEvents(timestamp) {
    // Charging starts and completions are recorded in charging_sessions table
    // This is handled by charging-phase
    // No additional recording needed here
}
async function recordShipmentEvents(timestamp) {
    // Shipment assignments and deliveries are recorded in shipments table
    // This is handled by freight-phase
    // No additional recording needed here
}
async function recordDriverAssignments(timestamp) {
    // Driver-truck assignments are tracked in drivers.assignedTruckId
    // This is handled by bootstrap-phase and driver assignment endpoints
    // No additional recording needed here
}
async function recordIncidents(timestamp) {
    // Incidents are recorded in station_incidents table
    // This is handled by incidents-faults-phase
    // No additional recording needed here
}
async function recordChargerFaults(timestamp) {
    // Charger faults are recorded in charger_faults table
    // This is handled by incidents-faults-phase
    // No additional recording needed here
}
