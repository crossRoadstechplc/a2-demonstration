/**
 * Freight Phase
 * 
 * Handles freight operations:
 * - Shipment generation
 * - Shipment assignment (immediate)
 * - Shipment state transitions
 * - Delivery completion
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { SimulationContext, ShipmentRow } from "../types";
import { randomInt } from "../utils";

export async function runFreightPhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  // Generate new shipments if needed
  await generateShipments(timestamp, context);

  // Transition ASSIGNED -> IN_TRANSIT
  await transitionToInTransit(timestamp, context);

  // Complete IN_TRANSIT -> DELIVERED
  await completeDeliveries(timestamp, context);
}

async function generateShipments(timestamp: string, context: SimulationContext): Promise<void> {
  const activeCount = await getQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM shipments WHERE status IN ('ASSIGNED','IN_TRANSIT');"
  );

  // Apply scenario modifier for shipment generation
  const shipmentMultiplier = context.scenarioModifiers.shipmentGenerationMultiplier ?? 1.0;
  const refrigeratedMultiplier = context.scenarioModifiers.refrigeratedShipmentMultiplier ?? 1.0;
  
  // Adjust target active shipments based on multiplier
  const baseTarget = 5;
  const targetActive = Math.floor(baseTarget * shipmentMultiplier);

  // Keep active shipments at target level
  if ((activeCount?.count ?? 0) < targetActive) {
    const stationCoords = [
      { name: "Addis Ababa (Main Hub)", lat: 8.9806, lng: 38.7578 },
      { name: "Adama", lat: 8.54, lng: 39.27 },
      { name: "Awash", lat: 8.98, lng: 40.17 },
      { name: "Mieso", lat: 9.24, lng: 40.75 },
      { name: "Dire Dawa", lat: 9.6, lng: 41.86 },
      { name: "Semera / Mille area", lat: 11.79, lng: 41.01 },
      { name: "Djibouti Port Gateway", lat: 11.58, lng: 43.15 },
    ];
    const toCreate = Math.min(targetActive - (activeCount?.count ?? 0), Math.floor(3 * shipmentMultiplier));
    for (let index = 0; index < toCreate; index += 1) {
      const pickupIdx = randomInt(stationCoords.length - 1);
      const deliveryIdx = (pickupIdx + 1 + randomInt(3)) % stationCoords.length;
      const pickup = stationCoords[pickupIdx];
      const delivery = stationCoords[deliveryIdx];
      
      // Apply scenario modifier for refrigerated shipments
      // Base: 1 in 3 shipments are refrigerated
      // With multiplier > 1.0, increase refrigerated ratio
      const baseRefrigeratedRatio = 1 / 3;
      const adjustedRatio = Math.min(1.0, baseRefrigeratedRatio * refrigeratedMultiplier);
      const requiresRefrigeration = Math.random() < adjustedRatio ? 1 : 0;

      // Find eligible truck
      const candidateTrucks = await allQuery<{
        id: number;
        fleetId: number;
        currentSoc: number;
        status: string;
        truckType: string;
        availability: string;
        locationLat: number | null;
        locationLng: number | null;
      }>(
        `
        SELECT t.id, t.fleetId, t.currentSoc, t.status, t.truckType, t.availability, t.locationLat, t.locationLng
        FROM trucks t
        WHERE t.status = 'READY' AND t.availability = 'AVAILABLE'
        ${requiresRefrigeration ? "AND t.truckType = 'REFRIGERATED'" : ""}
        ORDER BY t.currentSoc DESC
        LIMIT 5;
      `
      );

      if (candidateTrucks.length === 0) {
        continue; // Skip if no eligible trucks
      }

      // Select truck closest to pickup (if coordinates available) or highest SOC
      const selectedTruck = candidateTrucks
        .map((t) => {
          let distance = 999;
          if (t.locationLat !== null && t.locationLng !== null) {
            const dLat = ((pickup.lat - t.locationLat) * Math.PI) / 180;
            const dLng = ((pickup.lng - t.locationLng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((t.locationLat * Math.PI) / 180) *
                Math.cos((pickup.lat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance = 6371 * c; // km
          }
          return { ...t, distance };
        })
        .sort((a, b) => {
          if (Math.abs(a.distance - b.distance) > 0.5) return a.distance - b.distance;
          return b.currentSoc - a.currentSoc;
        })[0];

      // Find driver for truck's fleet
      const selectedDriver = await getQuery<{ id: number; fleetId: number; status: string }>(
        `
        SELECT id, fleetId, status
        FROM drivers
        WHERE fleetId = ? AND status = 'AVAILABLE'
        ORDER BY overallRating DESC, id ASC
        LIMIT 1;
      `,
        [selectedTruck.fleetId]
      );

      if (!selectedDriver) {
        continue; // Skip if no driver available
      }

      // Create shipment with immediate assignment
      const result = await runQuery(
        `
        INSERT INTO shipments
        (pickupLocation, pickupLat, pickupLng, deliveryLocation, deliveryLat, deliveryLng, cargoDescription, weight, volume, pickupWindow, requiresRefrigeration, temperatureTarget, customerId, truckId, driverId, approvedLoad, status, assignedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '06:00-10:00', ?, ?, 1, ?, ?, 1, 'ASSIGNED', ?);
      `,
        [
          pickup.name,
          pickup.lat,
          pickup.lng,
          delivery.name,
          delivery.lat,
          delivery.lng,
          `Demo cargo ${index + 1}`,
          4 + index * 0.5,
          10 + index,
          requiresRefrigeration,
          requiresRefrigeration ? 3 : null,
          selectedTruck.id,
          selectedDriver.id,
          timestamp,
        ]
      );

      // Update truck and driver
      await runQuery("UPDATE trucks SET status = 'IN_TRANSIT', assignedDriverId = ? WHERE id = ?;", [
        selectedDriver.id,
        selectedTruck.id,
      ]);
      await runQuery("UPDATE drivers SET status = 'ACTIVE' WHERE id = ?;", [selectedDriver.id]);

      // Create shipment events
      await runQuery(
        "INSERT INTO shipment_events (shipmentId, eventType, message, timestamp) VALUES (?, 'REQUESTED', 'Shipment request created by simulation', ?);",
        [result.lastID, timestamp]
      );
      await runQuery(
        "INSERT INTO shipment_events (shipmentId, eventType, message, timestamp) VALUES (?, 'ASSIGNED', 'Shipment assigned by simulation', ?);",
        [result.lastID, timestamp]
      );
    }
  }
}

async function transitionToInTransit(timestamp: string, context: SimulationContext): Promise<void> {
  // Apply scenario modifier for freight completion
  const completionMultiplier = context.scenarioModifiers.freightCompletionMultiplier ?? 1.0;
  const baseLimit = 4;
  const limit = Math.floor(baseLimit * completionMultiplier);
  
  // Transition ASSIGNED shipments to IN_TRANSIT per cycle
  const toTransit = await allQuery<ShipmentRow>(
    `SELECT id, status, truckId, driverId FROM shipments WHERE status = 'ASSIGNED' ORDER BY id ASC LIMIT ${limit};`
  );
  for (const shipment of toTransit) {
    await runQuery(
      "UPDATE shipments SET acceptedAt = COALESCE(acceptedAt, ?), pickupConfirmedAt = COALESCE(pickupConfirmedAt, ?), status = 'IN_TRANSIT' WHERE id = ?;",
      [timestamp, timestamp, shipment.id]
    );
    await runQuery(
      "INSERT INTO shipment_events (shipmentId, eventType, message, timestamp) VALUES (?, 'IN_TRANSIT', 'Shipment is now in transit', ?);",
      [shipment.id, timestamp]
    );
  }
}

async function completeDeliveries(timestamp: string, context: SimulationContext): Promise<void> {
  // Apply scenario modifier for freight completion
  const completionMultiplier = context.scenarioModifiers.freightCompletionMultiplier ?? 1.0;
  const baseLimit = 3;
  const limit = Math.floor(baseLimit * completionMultiplier);
  
  // Complete IN_TRANSIT shipments per cycle
  const toDeliver = await allQuery<ShipmentRow>(
    `SELECT id, status, truckId, driverId FROM shipments WHERE status = 'IN_TRANSIT' ORDER BY id ASC LIMIT ${limit};`
  );
  for (const shipment of toDeliver) {
    await runQuery(
      "UPDATE shipments SET deliveryConfirmedAt = ?, status = 'DELIVERED' WHERE id = ?;",
      [timestamp, shipment.id]
    );
    await runQuery(
      "INSERT INTO shipment_events (shipmentId, eventType, message, timestamp) VALUES (?, 'DELIVERED', 'Shipment delivered successfully', ?);",
      [shipment.id, timestamp]
    );

    // Update driver completed trips
    if (shipment.driverId) {
      await runQuery("UPDATE drivers SET completedTrips = completedTrips + 1 WHERE id = ?;", [
        shipment.driverId,
      ]);
    }

    // Return truck to READY status
    if (shipment.truckId) {
      await runQuery("UPDATE trucks SET status = 'READY', availability = 'AVAILABLE' WHERE id = ?;", [
        shipment.truckId,
      ]);
    }
  }
}
