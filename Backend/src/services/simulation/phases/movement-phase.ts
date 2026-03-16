/**
 * Movement Phase
 * 
 * Updates truck movement:
 * - Truck positions (locationLat/locationLng)
 * - currentStationId updates
 * - SOC drain during transit
 * - Status transitions (READY -> IN_TRANSIT -> READY)
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { BatteryRow, SimulationContext, TruckRow } from "../types";
import { findNextStationId, getStationCoordinate, interpolatePoint, round2 } from "../utils";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function runMovementPhase(context: SimulationContext): Promise<void> {
  const { stations, stationIds, stationById, truckMotionById } = context;

  const trucks = await allQuery<TruckRow>(
    "SELECT id, truckType, batteryId, status, currentSoc, refrigerationPowerDraw, currentStationId, locationLat, locationLng, assignedDriverId FROM trucks ORDER BY id ASC;"
  );

  for (const truck of trucks) {
    const sourceStationId = truck.currentStationId ?? stationIds[truck.id % stationIds.length];
    const sourceStation = stationById.get(sourceStationId) ?? stations[0];
    const sourceCoordinate = getStationCoordinate(sourceStation);
    const destinationStationId = findNextStationId(sourceStationId, stationIds);
    const destinationStation = stationById.get(destinationStationId) ?? sourceStation;

    // Check for maintenance edge cases (occasional maintenance needs)
    if (truck.status === "READY" || truck.status === "IDLE" || truck.status === "IN_TRANSIT") {
      // 0.5% chance per cycle that truck needs maintenance (realistic failure rate)
      if (Math.random() < 0.005) {
        await runQuery(
          "UPDATE trucks SET status = 'MAINTENANCE', availability = 'UNAVAILABLE' WHERE id = ?;",
          [truck.id]
        );
        continue;
      }
    }

    // Restore trucks from maintenance after some time (20% chance per cycle)
    if (truck.status === "MAINTENANCE") {
      if (Math.random() < 0.2) {
        await runQuery(
          "UPDATE trucks SET status = 'READY', availability = 'AVAILABLE' WHERE id = ?;",
          [truck.id]
        );
      }
      continue;
    }

    // Start movement if truck is READY/IDLE and has a driver
    if (truck.status === "READY" || truck.status === "IDLE") {
      if (truck.assignedDriverId) {
        truckMotionById.set(truck.id, {
          fromStationId: sourceStationId,
          toStationId: destinationStationId,
          progress: 0,
        });
        // Clear currentStationId when departing
        await runQuery(
          "UPDATE trucks SET status = 'IN_TRANSIT', currentStationId = NULL, locationLat = ?, locationLng = ?, availability = 'ACTIVE' WHERE id = ?;",
          [sourceCoordinate.lat, sourceCoordinate.lng, truck.id]
        );
      }
      continue;
    }

    // Skip if not in transit
    if (truck.status !== "IN_TRANSIT") {
      continue;
    }

    // Get truck's battery
    const truckBattery = await getQuery<BatteryRow>(
      `
      SELECT id, capacityKwh, soc, status, stationId, truckId
      FROM batteries
      WHERE truckId = ?
      ORDER BY id ASC
      LIMIT 1;
    `,
      [truck.id]
    );

    // Get or create motion state
    const currentMotion = truckMotionById.get(truck.id) ?? {
      fromStationId: sourceStationId,
      toStationId: destinationStationId,
      progress: 0,
    };
    const fromStation = stationById.get(currentMotion.fromStationId) ?? sourceStation;
    const toStation = stationById.get(currentMotion.toStationId) ?? destinationStation;
    const fromCoordinate = getStationCoordinate(fromStation);
    const toCoordinate = getStationCoordinate(toStation);

    // Update progress (apply scenario modifier if active)
    const baseProgressStep = 0.3 + (truck.id % 3) * 0.08;
    const movementMultiplier = context.scenarioModifiers.truckMovementMultiplier ?? 1.0;
    const progressStep = baseProgressStep * movementMultiplier;
    const nextProgress = Math.min(1, currentMotion.progress + progressStep);
    const nextPoint = interpolatePoint(fromCoordinate, toCoordinate, nextProgress);

    // Update truck location
    await runQuery(
      "UPDATE trucks SET locationLat = ?, locationLng = ?, currentStationId = NULL, availability = 'ACTIVE' WHERE id = ?;",
      [nextPoint.lat, nextPoint.lng, truck.id]
    );

    // Realistic SOC drain based on distance traveled and truck type
    if (truckBattery) {
      // Calculate distance traveled this cycle (progress delta * total distance)
      const fromCoord = getStationCoordinate(fromStation);
      const toCoord = getStationCoordinate(toStation);
      const totalDistanceKm = haversineDistance(
        fromCoord.lat,
        fromCoord.lng,
        toCoord.lat,
        toCoord.lng
      );
      const progressDelta = nextProgress - currentMotion.progress;
      const distanceThisCycle = totalDistanceKm * progressDelta;

      // Base energy consumption: ~2 kWh per km for standard trucks
      // Refrigerated trucks consume extra energy for cooling
      const baseEnergyKwh = distanceThisCycle * 2.0;
      const extraEnergyKwh = truck.truckType === "REFRIGERATED" 
        ? (distanceThisCycle * truck.refrigerationPowerDraw) / 100 // Extra kWh per km
        : 0;
      
      const totalEnergyKwh = baseEnergyKwh + extraEnergyKwh;
      
      // Apply scenario modifier for SOC drain
      const socDrainMultiplier = context.scenarioModifiers.socDrainMultiplier ?? 1.0;
      const adjustedEnergyKwh = totalEnergyKwh * socDrainMultiplier;
      
      // Convert energy to SOC drop (based on 588 kWh capacity)
      const socDrop = round2((adjustedEnergyKwh / truckBattery.capacityKwh) * 100);
      // Enforce 25% SOC minimum floor (realistic operational reserve)
      const newSoc = round2(Math.max(25, truckBattery.soc - socDrop));

      await runQuery("UPDATE batteries SET soc = ? WHERE id = ?;", [newSoc, truckBattery.id]);
      await runQuery("UPDATE trucks SET currentSoc = ? WHERE id = ?;", [newSoc, truck.id]);
    }

    // Check if arrived at destination
    if (nextProgress >= 1) {
      truckMotionById.delete(truck.id);
      await runQuery(
        "UPDATE trucks SET status = 'READY', currentStationId = ?, locationLat = ?, locationLng = ? WHERE id = ?;",
        [currentMotion.toStationId, toCoordinate.lat, toCoordinate.lng, truck.id]
      );
    } else {
      // Update motion state
      truckMotionById.set(truck.id, {
        ...currentMotion,
        progress: nextProgress,
      });
    }
  }
}
