/**
 * Incidents and Faults Phase
 * 
 * Handles:
 * - Queue congestion incidents
 * - Station incidents
 * - Charger fault generation
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { SimulationContext } from "../types";
import { randomInt } from "../utils";

export async function runIncidentsFaultsPhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  // Check for queue congestion
  await checkQueueCongestion(timestamp, context);

  // Check for battery shortages
  await checkBatteryShortages(timestamp, context);

  // Generate charger faults (1-2% chance per active charger)
  await generateChargerFaults(timestamp, context);

  // Auto-resolve some open faults (10-20% chance per cycle)
  await autoResolveFaults(timestamp);

  // Generate grid notices if scenario requires
  await generateGridNotices(timestamp, context);
}

async function checkQueueCongestion(timestamp: string, context: SimulationContext): Promise<void> {
  // Check stations for queue congestion based on actual queue size
  // Apply scenario modifier for queue threshold
  const queueThreshold = context.scenarioModifiers.queueThreshold ?? 5;
  const incidentMultiplier = context.scenarioModifiers.incidentGenerationMultiplier ?? 1.0;
  
  const stations = await allQuery<{ id: number; name: string }>(
    "SELECT id, name FROM stations WHERE status = 'ACTIVE';"
  );

  for (const station of stations) {
    // Check if station is targeted by scenario
    const targetStationIds = context.scenarioModifiers.targetStationIds;
    const isTargetStation = !targetStationIds || targetStationIds.length === 0 || targetStationIds.includes(station.id);

    // Count queue entries (PENDING + ARRIVED)
    const queueCount = await getQuery<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM swap_queue 
       WHERE stationId = ? AND status IN ('PENDING', 'ARRIVED');`,
      [station.id]
    );

    // Also count trucks at station waiting
    const trucksWaiting = await getQuery<{ count: number }>(
      `SELECT COUNT(*) as count 
       FROM trucks 
       WHERE currentStationId = ? AND status = 'READY';`,
      [station.id]
    );

    const totalQueueSize = (queueCount?.count ?? 0) + (trucksWaiting?.count ?? 0);

    // Trigger congestion if queue > threshold
    // Apply incident multiplier (higher = more likely to generate incidents)
    if (totalQueueSize > queueThreshold && (isTargetStation || Math.random() < incidentMultiplier)) {
      // Check if there's already an open queue congestion incident
      const existing = await getQuery<{ id: number }>(
        "SELECT id FROM station_incidents WHERE stationId = ? AND type = 'QUEUE_CONGESTION' AND status = 'OPEN' LIMIT 1;",
        [station.id]
      );
      if (!existing) {
        const severity = totalQueueSize > 10 ? 'HIGH' : totalQueueSize > 7 ? 'MEDIUM' : 'LOW';
        await runQuery(
          "INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt) VALUES (?, 'QUEUE_CONGESTION', ?, ?, 'OPEN', ?);",
          [station.id, severity, `Queue congestion: ${totalQueueSize} trucks waiting`, timestamp]
        );
      } else {
        // Update existing incident if queue size changed significantly
        await runQuery(
          "UPDATE station_incidents SET message = ?, severity = ? WHERE id = ?;",
          [`Queue congestion: ${totalQueueSize} trucks waiting`, totalQueueSize > 10 ? 'HIGH' : totalQueueSize > 7 ? 'MEDIUM' : 'LOW', existing.id]
        );
      }
    } else {
      // Resolve congestion incidents if queue cleared
      await runQuery(
        "UPDATE station_incidents SET status = 'RESOLVED', resolvedAt = ? WHERE stationId = ? AND type = 'QUEUE_CONGESTION' AND status = 'OPEN';",
        [timestamp, station.id]
      );
    }
  }
}

async function checkBatteryShortages(timestamp: string, context: SimulationContext): Promise<void> {
  // Check stations for battery shortages (ready batteries < 10% of capacity)
  const stations = await allQuery<{ id: number; capacity: number }>(
    "SELECT id, capacity FROM stations WHERE status = 'ACTIVE';"
  );

  const incidentMultiplier = context.scenarioModifiers.incidentGenerationMultiplier ?? 1.0;
  const targetStationIds = context.scenarioModifiers.targetStationIds;

  for (const station of stations) {
    // Check if station is targeted by scenario
    const isTargetStation = !targetStationIds || targetStationIds.length === 0 || targetStationIds.includes(station.id);
    
    const readyBatteries = await getQuery<{ count: number }>(
      "SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'READY';",
      [station.id]
    );
    const threshold = Math.floor(station.capacity * 0.1);
    if ((readyBatteries?.count ?? 0) < threshold && (isTargetStation || Math.random() < incidentMultiplier)) {
      // Check if incident already exists
      const existing = await getQuery<{ id: number }>(
        "SELECT id FROM station_incidents WHERE stationId = ? AND type = 'BATTERY_SHORTAGE' AND status = 'OPEN' LIMIT 1;",
        [station.id]
      );
      if (!existing) {
        await runQuery(
          "INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt) VALUES (?, 'BATTERY_SHORTAGE', 'HIGH', 'Ready battery count below 10% of capacity', 'OPEN', ?);",
          [station.id, timestamp]
        );
      }
    }
  }
}

async function generateChargerFaults(timestamp: string, context: SimulationContext): Promise<void> {
  // Get active charging sessions (each represents an active charger)
  const activeSessions = await allQuery<{ stationId: number }>(
    "SELECT DISTINCT stationId FROM charging_sessions WHERE status = 'ACTIVE';"
  );

  // Apply scenario modifier for charger fault probability
  const faultMultiplier = context.scenarioModifiers.chargerFaultMultiplier ?? 1.0;
  const baseFaultProbability = 0.015; // 1.5% base probability
  const faultProbability = Math.min(1.0, baseFaultProbability * faultMultiplier);

  const errorCodes = ["E114", "E201", "E305", "E402", "E503"];
  const descriptions = [
    "Charger communication timeout",
    "Overcurrent protection triggered",
    "Temperature sensor fault",
    "Ground fault detected",
    "Power supply failure",
  ];

  const targetStationIds = context.scenarioModifiers.targetStationIds;

  for (const session of activeSessions) {
    // Check if station is targeted by scenario
    const isTargetStation = !targetStationIds || targetStationIds.length === 0 || targetStationIds.includes(session.stationId);
    
    // Only generate faults at target stations if specified, otherwise all stations
    if (!isTargetStation && targetStationIds && targetStationIds.length > 0) {
      continue;
    }

    // Apply fault probability with multiplier
    if (Math.random() < faultProbability) {
      const errorIndex = randomInt(errorCodes.length);
      const errorCode = errorCodes[errorIndex];
      const description = descriptions[errorIndex];

      // Check if fault already exists for this station
      const existing = await getQuery<{ id: number }>(
        "SELECT id FROM charger_faults WHERE stationId = ? AND status = 'OPEN' LIMIT 1;",
        [session.stationId]
      );
      if (!existing) {
        const chargerId = `CHG-${String(session.stationId).padStart(2, "0")}`;
        await runQuery(
          "INSERT INTO charger_faults (stationId, chargerId, errorCode, description, status, reportedAt) VALUES (?, ?, ?, ?, 'OPEN', ?);",
          [session.stationId, chargerId, errorCode, description, timestamp]
        );
      }
    }
  }
}

async function autoResolveFaults(timestamp: string): Promise<void> {
  // 10-20% chance to auto-resolve open faults
  if (Math.random() < 0.15) {
    const openFaults = await allQuery<{ id: number }>(
      "SELECT id FROM charger_faults WHERE status = 'OPEN' ORDER BY RANDOM() LIMIT 1;"
    );
    if (openFaults.length > 0) {
      const fault = openFaults[0];
      await runQuery(
        "UPDATE charger_faults SET status = 'RESOLVED', resolvedAt = ? WHERE id = ?;",
        [timestamp, fault.id]
      );
    }

    // Also resolve some incidents
    const openIncidents = await allQuery<{ id: number }>(
      "SELECT id FROM station_incidents WHERE status = 'OPEN' ORDER BY RANDOM() LIMIT 1;"
    );
    if (openIncidents.length > 0) {
      const incident = openIncidents[0];
      await runQuery(
        "UPDATE station_incidents SET status = 'RESOLVED', resolvedAt = ? WHERE id = ?;",
        [timestamp, incident.id]
      );
    }
  }
}

async function generateGridNotices(timestamp: string, context: SimulationContext): Promise<void> {
  // Generate grid constraint notices if scenario requires
  const gridNoticeProbability = context.scenarioModifiers.gridNoticeProbability ?? 0;
  
  if (gridNoticeProbability > 0 && Math.random() < gridNoticeProbability) {
    // Create a grid notice incident (stored as a special incident type)
    // For now, we'll create a station incident with type GRID_CONSTRAINT
    const stations = await allQuery<{ id: number }>(
      "SELECT id FROM stations WHERE status = 'ACTIVE' ORDER BY RANDOM() LIMIT 1;"
    );
    
    if (stations.length > 0) {
      const station = stations[0];
      // Check if notice already exists
      const existing = await getQuery<{ id: number }>(
        "SELECT id FROM station_incidents WHERE stationId = ? AND type = 'GRID_CONSTRAINT' AND status = 'OPEN' LIMIT 1;",
        [station.id]
      );
      
      if (!existing) {
        await runQuery(
          "INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt) VALUES (?, 'GRID_CONSTRAINT', 'HIGH', 'Grid constraint warning: High load detected', 'OPEN', ?);",
          [station.id, timestamp]
        );
      }
    }
  }
}
