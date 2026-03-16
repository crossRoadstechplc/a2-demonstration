"use strict";
/**
 * Queue Management Phase
 *
 * Manages swap queue entries:
 * - Adds trucks to queue when they need swaps
 * - Updates queue entries based on distance
 * - Removes completed queue entries
 * - Orders queue by distance from station
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQueueManagementPhase = runQueueManagementPhase;
const connection_1 = require("../../../database/connection");
const utils_1 = require("../utils");
async function runQueueManagementPhase(context) {
    const { timestamp, stations } = context;
    // Find trucks in transit that need swaps
    // Apply scenario modifier for queue buildup (lower threshold = more trucks queued)
    const queueBuildUpMultiplier = context.scenarioModifiers.queueBuildUpMultiplier ?? 1.0;
    const socThreshold = queueBuildUpMultiplier > 1.0 ? 60 : 50; // Higher threshold = more trucks need swaps
    const trucksNeedingSwap = await (0, connection_1.allQuery)(`
    SELECT t.id, t.truckType, t.batteryId, t.status, t.currentSoc, t.refrigerationPowerDraw,
           t.currentStationId, t.locationLat, t.locationLng, t.assignedDriverId
    FROM trucks t
    WHERE t.status = 'IN_TRANSIT' 
      AND t.currentSoc < ?
      AND t.locationLat IS NOT NULL
      AND t.locationLng IS NOT NULL;
    `, [socThreshold]);
    // For each truck needing swap, find nearest station and add to queue if not already queued
    for (const truck of trucksNeedingSwap) {
        if (!truck.locationLat || !truck.locationLng) {
            continue;
        }
        // Find nearest station
        let nearestStation = stations[0];
        let minDistance = Infinity;
        for (const station of stations) {
            const stationCoord = (0, utils_1.getStationCoordinate)(station);
            const distance = haversineDistance(truck.locationLat, truck.locationLng, stationCoord.lat, stationCoord.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = station;
            }
        }
        // Check if already in queue for this station
        const existingQueue = await (0, connection_1.getQuery)("SELECT id, distanceKm FROM swap_queue WHERE truckId = ? AND stationId = ? AND status IN ('PENDING', 'ARRIVED');", [truck.id, nearestStation.id]);
        if (!existingQueue) {
            // Calculate estimated arrival time (assuming 60 km/h average speed)
            const hoursToArrival = minDistance / 60;
            const estimatedArrival = new Date(Date.now() + hoursToArrival * 60 * 60 * 1000).toISOString();
            // Add to queue with deterministic ordering (by distance, then by truck ID)
            await (0, connection_1.runQuery)(`
        INSERT INTO swap_queue (truckId, stationId, bookedAt, estimatedArrival, distanceKm, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING');
      `, [truck.id, nearestStation.id, timestamp, estimatedArrival, (0, utils_1.round2)(minDistance)]);
        }
        else {
            // Update distance and ETA if truck has moved
            const hoursToArrival = minDistance / 60;
            const estimatedArrival = new Date(Date.now() + hoursToArrival * 60 * 60 * 1000).toISOString();
            await (0, connection_1.runQuery)("UPDATE swap_queue SET distanceKm = ?, estimatedArrival = ? WHERE id = ?;", [(0, utils_1.round2)(minDistance), estimatedArrival, existingQueue.id]);
        }
    }
    // Reorder queue entries by distance (deterministic ordering)
    // This ensures queue is always ordered by distance from station
    await reorderQueueByDistance();
    // Mark queue entries as ARRIVED when truck reaches station
    const arrivedTrucks = await (0, connection_1.allQuery)(`
    SELECT t.id as truckId, t.currentStationId as stationId
    FROM trucks t
    WHERE t.status = 'READY' 
      AND t.currentStationId IS NOT NULL;
    `);
    for (const arrival of arrivedTrucks) {
        await (0, connection_1.runQuery)("UPDATE swap_queue SET status = 'ARRIVED' WHERE truckId = ? AND stationId = ? AND status = 'PENDING';", [arrival.truckId, arrival.stationId]);
    }
    // Mark queue entries as COMPLETED when swap is done
    const completedSwaps = await (0, connection_1.allQuery)(`
    SELECT st.truckId, st.stationId
    FROM swap_transactions st
    WHERE date(st.timestamp, 'localtime') = date('now', 'localtime')
      AND st.timestamp >= datetime('now', '-10 seconds');
    `);
    for (const swap of completedSwaps) {
        await (0, connection_1.runQuery)("UPDATE swap_queue SET status = 'COMPLETED' WHERE truckId = ? AND stationId = ? AND status IN ('PENDING', 'ARRIVED');", [swap.truckId, swap.stationId]);
    }
    // Clean up old completed queue entries (older than 1 day)
    await (0, connection_1.runQuery)("DELETE FROM swap_queue WHERE status = 'COMPLETED' AND bookedAt < datetime('now', '-1 day');");
}
async function reorderQueueByDistance() {
    // Queue ordering is deterministic: by distance (ascending), then by bookedAt (ascending)
    // This ensures fair first-come-first-served within distance groups
    // Note: SQLite doesn't support UPDATE with ORDER BY, so we do this in application logic
    // The queue is naturally ordered when queried: ORDER BY distanceKm ASC, bookedAt ASC
}
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
