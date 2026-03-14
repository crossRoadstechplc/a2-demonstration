import { Router } from "express";

import { allQuery, getQuery } from "../../database/connection";

interface CountRow {
  count: number;
}

interface SumRow {
  total: number | null;
}

const dashboardRouter = Router();

async function count(sql: string, params: Array<string | number> = []): Promise<number> {
  const row = await getQuery<CountRow>(sql, params);
  return row?.count ?? 0;
}

async function sum(sql: string, params: Array<string | number> = []): Promise<number> {
  const row = await getQuery<SumRow>(sql, params);
  return Number((row?.total ?? 0).toFixed(2));
}

dashboardRouter.get("/dashboard/a2", async (_req, res, next) => {
  try {
    const activeTrucks = await count(
      "SELECT COUNT(*) as count FROM trucks WHERE status = 'IN_TRANSIT';"
    );
    const swapsToday = await count(
      "SELECT COUNT(*) as count FROM swap_transactions WHERE date(timestamp) = date('now');"
    );
    const batteriesReady = await count(
      "SELECT COUNT(*) as count FROM batteries WHERE status = 'READY';"
    );
    const energyToday = await sum(
      "SELECT COALESCE(SUM(energyDeliveredKwh), 0) as total FROM swap_transactions WHERE date(timestamp) = date('now');"
    );
    const incidents = await count(
      `
      SELECT COUNT(*) as count
      FROM driver_telemetry
      WHERE speed > 100 OR brakeForce > 0.8;
    `
    );
    const stationsOnline = await count(
      "SELECT COUNT(*) as count FROM stations WHERE status = 'ACTIVE';"
    );

    res.status(200).json({
      activeTrucks,
      swapsToday,
      batteriesReady,
      energyToday,
      incidents,
      stationsOnline
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/station/:id", async (req, res, next) => {
  try {
    const stationId = Number(req.params.id);
    if (Number.isNaN(stationId)) {
      res.status(400).json({ error: "Invalid station id" });
      return;
    }

    const station = await getQuery<{ id: number; name: string; status: string }>(
      "SELECT id, name, status FROM stations WHERE id = ?;",
      [stationId]
    );
    if (!station) {
      res.status(404).json({ error: "Station not found" });
      return;
    }

    const batteriesAtStation = await count(
      "SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;",
      [stationId]
    );
    const activeChargingSessions = await count(
      "SELECT COUNT(*) as count FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';",
      [stationId]
    );
    const swapsToday = await count(
      "SELECT COUNT(*) as count FROM swap_transactions WHERE stationId = ? AND date(timestamp) = date('now');",
      [stationId]
    );
    const energyToday = await sum(
      "SELECT COALESCE(SUM(energyDeliveredKwh), 0) as total FROM swap_transactions WHERE stationId = ? AND date(timestamp) = date('now');",
      [stationId]
    );

    res.status(200).json({
      stationId: station.id,
      stationName: station.name,
      stationStatus: station.status,
      batteriesAtStation,
      activeChargingSessions,
      swapsToday,
      energyToday
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/fleet/:id", async (req, res, next) => {
  try {
    const fleetId = Number(req.params.id);
    if (Number.isNaN(fleetId)) {
      res.status(400).json({ error: "Invalid fleet id" });
      return;
    }

    const fleet = await getQuery<{ id: number; name: string }>(
      "SELECT id, name FROM fleets WHERE id = ?;",
      [fleetId]
    );
    if (!fleet) {
      res.status(404).json({ error: "Fleet not found" });
      return;
    }

    const totalTrucks = await count("SELECT COUNT(*) as count FROM trucks WHERE fleetId = ?;", [
      fleetId
    ]);
    const activeTrucks = await count(
      "SELECT COUNT(*) as count FROM trucks WHERE fleetId = ? AND status = 'IN_TRANSIT';",
      [fleetId]
    );
    const availableDrivers = await count(
      "SELECT COUNT(*) as count FROM drivers WHERE fleetId = ? AND status = 'AVAILABLE';",
      [fleetId]
    );
    const activeShipments = await count(
      `
      SELECT COUNT(*) as count
      FROM shipments s
      INNER JOIN trucks t ON t.id = s.truckId
      WHERE t.fleetId = ? AND s.status IN ('ASSIGNED', 'IN_TRANSIT');
    `,
      [fleetId]
    );

    res.status(200).json({
      fleetId: fleet.id,
      fleetName: fleet.name,
      totalTrucks,
      activeTrucks,
      availableDrivers,
      activeShipments
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/driver/:id", async (req, res, next) => {
  try {
    const driverId = Number(req.params.id);
    if (Number.isNaN(driverId)) {
      res.status(400).json({ error: "Invalid driver id" });
      return;
    }

    const driver = await getQuery<{
      id: number;
      name: string;
      status: string;
      overallRating: number;
      safetyScore: number;
      speedViolations: number;
      harshBrakes: number;
      completedTrips: number;
      tripEfficiency: number;
    }>("SELECT * FROM drivers WHERE id = ?;", [driverId]);
    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.status(200).json({
      driverId: driver.id,
      driverName: driver.name,
      status: driver.status,
      overallRating: driver.overallRating,
      safetyScore: driver.safetyScore,
      speedViolations: driver.speedViolations,
      harshBrakes: driver.harshBrakes,
      completedTrips: driver.completedTrips,
      tripEfficiency: driver.tripEfficiency
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/eeu", async (_req, res, next) => {
  try {
    const swapsToday = await count(
      "SELECT COUNT(*) as count FROM swap_transactions WHERE date(timestamp) = date('now');"
    );
    const energySoldToday = await sum(
      "SELECT COALESCE(SUM(energyKwh), 0) as total FROM receipts WHERE date(timestamp) = date('now');"
    );
    const revenueToday = await sum(
      "SELECT COALESCE(SUM(energyCharge), 0) as total FROM receipts WHERE date(timestamp) = date('now');"
    );
    const vatShareToday = await sum(
      "SELECT COALESCE(SUM(vat / 2), 0) as total FROM receipts WHERE date(timestamp) = date('now');"
    );
    const totalShareToday = Number((revenueToday + vatShareToday).toFixed(2));
    const activeStations = await count(
      "SELECT COUNT(*) as count FROM stations WHERE status = 'ACTIVE';"
    );

    res.status(200).json({
      swapsToday,
      energySoldToday,
      revenueToday,
      vatShareToday,
      totalShareToday,
      activeStations
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/freight/:customerId", async (req, res, next) => {
  try {
    const customerId = Number(req.params.customerId);
    if (Number.isNaN(customerId)) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const totalShipments = await count(
      "SELECT COUNT(*) as count FROM shipments WHERE customerId = ?;",
      [customerId]
    );
    const activeShipments = await count(
      "SELECT COUNT(*) as count FROM shipments WHERE customerId = ? AND status IN ('REQUESTED', 'ASSIGNED', 'IN_TRANSIT');",
      [customerId]
    );
    const estimatedSpend = await sum(
      `
      SELECT COALESCE(SUM(r.total), 0) as total
      FROM receipts r
      INNER JOIN swap_transactions s ON s.id = r.swapId
      INNER JOIN shipments sh ON sh.truckId = s.truckId
      WHERE sh.customerId = ?;
    `,
      [customerId]
    );
    const recentShipmentActivity = await allQuery(
      `
      SELECT sh.id, sh.status, se.eventType, se.message, se.timestamp
      FROM shipments sh
      LEFT JOIN shipment_events se ON se.shipmentId = sh.id
      WHERE sh.customerId = ?
      ORDER BY sh.id DESC, se.id DESC
      LIMIT 10;
    `,
      [customerId]
    );
    const deliveryConfirmations = await count(
      "SELECT COUNT(*) as count FROM shipments WHERE customerId = ? AND deliveryConfirmedAt IS NOT NULL;",
      [customerId]
    );

    res.status(200).json({
      customerId,
      totalShipments,
      activeShipments,
      estimatedSpend,
      recentShipmentActivity,
      deliveryConfirmations
    });
  } catch (error) {
    next(error);
  }
});

dashboardRouter.get("/dashboard/a2/live-feed", async (_req, res, next) => {
  try {
    const swaps = await allQuery(
      "SELECT id, truckId, stationId, energyDeliveredKwh, timestamp FROM swap_transactions ORDER BY id DESC LIMIT 10;"
    );
    const chargingStarts = await allQuery(
      "SELECT id, stationId, batteryId, startTime, status FROM charging_sessions ORDER BY id DESC LIMIT 10;"
    );
    const chargingCompletions = await allQuery(
      "SELECT id, stationId, batteryId, endTime, energyAddedKwh, status FROM charging_sessions WHERE status = 'COMPLETED' ORDER BY id DESC LIMIT 10;"
    );
    const incidents = await allQuery(
      "SELECT id, stationId, type, severity, message, status, reportedAt FROM station_incidents ORDER BY id DESC LIMIT 10;"
    );
    const chargerFaults = await allQuery(
      "SELECT id, stationId, chargerId, faultCode, message, status, reportedAt, resolvedAt FROM charger_faults ORDER BY id DESC LIMIT 10;"
    );
    const freightAssignments = await allQuery(
      "SELECT id, truckId, driverId, status, assignedAt FROM shipments WHERE assignedAt IS NOT NULL ORDER BY id DESC LIMIT 10;"
    );
    const truckArrivals = await allQuery(
      "SELECT id, stationId, truckId, driverId, arrivedAt FROM truck_arrivals ORDER BY id DESC LIMIT 10;"
    );

    res.status(200).json({
      swaps,
      chargingStarts,
      chargingCompletions,
      incidents,
      chargerFaults,
      freightAssignments,
      truckArrivals
    });
  } catch (error) {
    next(error);
  }
});

export default dashboardRouter;
