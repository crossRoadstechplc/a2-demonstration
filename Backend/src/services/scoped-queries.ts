/**
 * Scoped Query Service
 * 
 * Provides visibility-safe query helpers that enforce role-based access control.
 * All queries are scoped based on user role and organizationId.
 */

import type { Request } from "express";
import { allQuery, getQuery } from "../database/connection";
import type { UserRole } from "../modules/auth/auth.types";

interface CountRow {
  count: number;
}

interface SumRow {
  total: number | null;
}

/**
 * Get user's organization ID as number
 */
function getOrganizationId(req: Request): number | null {
  if (!req.user?.organizationId) {
    return null;
  }
  const orgId = Number(req.user.organizationId);
  return Number.isNaN(orgId) ? null : orgId;
}

/**
 * Check if user is admin or A2 operator (full system access)
 */
function isAdminOrA2Operator(req: Request): boolean {
  return req.user?.role === "ADMIN" || req.user?.role === "A2_OPERATOR";
}

/**
 * Scoped query helpers for each dashboard type
 */
export const scopedQueries = {
  /**
   * A2 HQ Queries - Full system access
   */
  a2: {
    async countActiveTrucks(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE status IN ('READY', 'IN_TRANSIT');"
      );
      return row?.count ?? 0;
    },

    async countSwapsToday(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );
      return row?.count ?? 0;
    },

    async countBatteriesReady(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE status = 'READY';"
      );
      return row?.count ?? 0;
    },

    async countChargingActive(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'ACTIVE';"
      );
      return row?.count ?? 0;
    },

    async sumCorridorEnergyToday(): Promise<number> {
      const row = await getQuery<SumRow>(
        "SELECT COALESCE(SUM(energyDeliveredKwh), 0) as total FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumCorridorRevenue(): Promise<number> {
      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         WHERE date(st.timestamp, 'localtime') = date('now', 'localtime');`
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumA2Share(): Promise<number> {
      const row = await getQuery<SumRow>(
        "SELECT COALESCE(SUM(a2Share), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumEeuShare(): Promise<number> {
      const row = await getQuery<SumRow>(
        "SELECT COALESCE(SUM(eeuShare), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumVatCollected(): Promise<number> {
      const row = await getQuery<SumRow>(
        "SELECT COALESCE(SUM(vat), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');"
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async countStationsOnline(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM stations WHERE status = 'ACTIVE';"
      );
      return row?.count ?? 0;
    },
  },

  /**
   * Fleet Queries - Scoped to fleetId = organizationId
   */
  fleet: {
    async countActiveTrucks(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE fleetId = ? AND status IN ('READY', 'IN_TRANSIT');",
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async countAvailableTrucks(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE fleetId = ? AND availability = 'AVAILABLE';",
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async countActiveDrivers(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM drivers WHERE fleetId = ? AND status = 'ACTIVE';",
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async countSwapsToday(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        `SELECT COUNT(*) as count
         FROM swap_transactions st
         JOIN trucks t ON st.truckId = t.id
         WHERE t.fleetId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime');`,
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async sumFleetEnergyCost(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         JOIN trucks t ON st.truckId = t.id
         WHERE t.fleetId = ? AND date(r.timestamp, 'localtime') = date('now', 'localtime');`,
        [fleetId]
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async countCompletedTrips(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        `SELECT COUNT(*) as count
         FROM shipments s
         JOIN trucks t ON s.truckId = t.id
         WHERE t.fleetId = ? AND s.status = 'DELIVERED';`,
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async countMaintenanceAlerts(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE fleetId = ? AND (status = 'MAINTENANCE' OR currentSoc < 20);",
        [fleetId]
      );
      return row?.count ?? 0;
    },

    async countRefrigeratedActive(req: Request): Promise<number> {
      const fleetId = getOrganizationId(req);
      if (!fleetId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE fleetId = ? AND truckType = 'REFRIGERATED' AND status = 'IN_TRANSIT';",
        [fleetId]
      );
      return row?.count ?? 0;
    },
  },

  /**
   * Station Queries - Scoped to stationId = organizationId
   */
  station: {
    async countTotalBatteries(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async countReadyBatteries(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'READY';",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async countChargingBatteries(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'CHARGING';",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async countTrucksAtStation(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM trucks WHERE currentStationId = ?;",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async countSwapsToday(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM swap_transactions WHERE stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime');",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async sumEnergyConsumedToday(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<SumRow>(
        "SELECT COALESCE(SUM(energyDeliveredKwh), 0) as total FROM swap_transactions WHERE stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime');",
        [stationId]
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumEnergyChargingNow(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      // Calculate current power draw: active charging sessions * charger output (50kW per charger)
      // This gives us the instantaneous power draw in kW
      const activeCount = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';",
        [stationId]
      );
      const chargerOutputKw = 50; // Standard charger output
      const currentPowerKw = (activeCount?.count ?? 0) * chargerOutputKw;
      return Number(currentPowerKw.toFixed(2));
    },

    async sumRevenueToday(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         WHERE st.stationId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime');`,
        [stationId]
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumRevenueThisMonth(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         WHERE st.stationId = ? AND strftime('%Y-%m', st.timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime');`,
        [stationId]
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async countChargerFaultsOpen(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charger_faults WHERE stationId = ? AND status = 'OPEN';",
        [stationId]
      );
      return row?.count ?? 0;
    },

    async countQueueSize(req: Request): Promise<number> {
      const stationId = getOrganizationId(req);
      if (!stationId) {
        return 0;
      }
      
      // Count queue entries
      let queueCount = 0;
      try {
        const queueRow = await getQuery<CountRow>(
          `SELECT COUNT(*) as count
           FROM swap_queue
           WHERE stationId = ? AND status IN ('PENDING', 'ARRIVED');`,
          [stationId]
        );
        queueCount = queueRow?.count ?? 0;
      } catch {
        // Table might not exist yet
        queueCount = 0;
      }

      // Count trucks at station waiting
      const trucksRow = await getQuery<CountRow>(
        `SELECT COUNT(*) as count
         FROM trucks
         WHERE currentStationId = ? AND status = 'READY';`,
        [stationId]
      );
      const trucksCount = trucksRow?.count ?? 0;

      return queueCount + trucksCount;
    },
  },

  /**
   * Driver Queries - Scoped to driverId = organizationId
   */
  driver: {
    async getCurrentSoc(req: Request): Promise<number | null> {
      const driverId = getOrganizationId(req);
      if (!driverId) {
        return null;
      }
      const row = await getQuery<{ currentSoc: number }>(
        `SELECT t.currentSoc
         FROM trucks t
         INNER JOIN drivers d ON t.id = d.assignedTruckId
         WHERE d.id = ?;`,
        [driverId]
      );
      return row?.currentSoc ?? null;
    },

    async getAssignedTruckPlate(req: Request): Promise<string | null> {
      const driverId = getOrganizationId(req);
      if (!driverId) {
        return null;
      }
      const row = await getQuery<{ plateNumber: string }>(
        `SELECT t.plateNumber
         FROM trucks t
         INNER JOIN drivers d ON t.id = d.assignedTruckId
         WHERE d.id = ?;`,
        [driverId]
      );
      return row?.plateNumber ?? null;
    },

    async getNextDestination(req: Request): Promise<string | null> {
      const driverId = getOrganizationId(req);
      if (!driverId) {
        return null;
      }
      const row = await getQuery<{ deliveryLocation: string }>(
        `SELECT deliveryLocation
         FROM shipments
         WHERE driverId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT')
         LIMIT 1;`,
        [driverId]
      );
      return row?.deliveryLocation ?? null;
    },
  },

  /**
   * Freight Queries - Scoped to customerId = organizationId
   */
  freight: {
    async countTotalShipments(req: Request, timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      const customerId = getOrganizationId(req);
      if (!customerId) {
        return 0;
      }
      
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "AND date(assignedAt, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "AND strftime('%Y-%m', assignedAt, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "AND strftime('%Y', assignedAt, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<CountRow>(
        `SELECT COUNT(*) as count FROM shipments WHERE customerId = ? ${dateFilter};`,
        [customerId]
      );
      return row?.count ?? 0;
    },

    async countActiveShipments(req: Request, timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      const customerId = getOrganizationId(req);
      if (!customerId) {
        return 0;
      }
      
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "AND date(assignedAt, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "AND strftime('%Y-%m', assignedAt, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "AND strftime('%Y', assignedAt, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<CountRow>(
        `SELECT COUNT(*) as count FROM shipments WHERE customerId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT') ${dateFilter};`,
        [customerId]
      );
      return row?.count ?? 0;
    },

    async countDeliveredShipments(req: Request, timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      const customerId = getOrganizationId(req);
      if (!customerId) {
        return 0;
      }
      
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "AND date(deliveryConfirmedAt, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "AND strftime('%Y-%m', deliveryConfirmedAt, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "AND strftime('%Y', deliveryConfirmedAt, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<CountRow>(
        `SELECT COUNT(*) as count FROM shipments WHERE customerId = ? AND status = 'DELIVERED' ${dateFilter};`,
        [customerId]
      );
      return row?.count ?? 0;
    },
  },

  /**
   * EEU Queries - Network-wide energy data only
   */
  eeu: {
    async countTotalNetworkLoad(): Promise<number> {
      // Total network load = sum of all active charger outputs (50 kW each)
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'ACTIVE';"
      );
      // Each active charger = 50 kW
      return (row?.count ?? 0) * 50;
    },

    async getStationLoads(): Promise<Array<{ stationId: number; loadKw: number }>> {
      // Get load per station (active chargers * 50 kW)
      const stationLoads = await allQuery<{ stationId: number; loadKw: number }>(
        `SELECT stationId, COUNT(*) * 50 as loadKw 
         FROM charging_sessions 
         WHERE status = 'ACTIVE' 
         GROUP BY stationId;`
      );
      return stationLoads;
    },

    async getPeakLoadStation(): Promise<{ stationId: number; loadKw: number } | null> {
      // Get station with highest current load
      const peakStation = await getQuery<{ stationId: number; loadKw: number }>(
        `SELECT stationId, COUNT(*) * 50 as loadKw 
         FROM charging_sessions 
         WHERE status = 'ACTIVE' 
         GROUP BY stationId 
         ORDER BY loadKw DESC 
         LIMIT 1;`
      );
      return peakStation ?? null;
    },

    async generate24HourForecast(): Promise<Array<{ hour: number; forecastLoadKw: number; forecastEnergyKwh: number }>> {
      // Simple 24-hour forecast based on current state and historical patterns
      // Uses current active chargers as baseline and applies time-of-day patterns
      const currentActive = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'ACTIVE';"
      );
      const currentLoad = (currentActive?.count ?? 0) * 50;

      // Get recent charging activity (last 24 hours) for pattern
      const recentActivity = await allQuery<{ hour: number; sessions: number }>(
        `SELECT CAST(strftime('%H', startTime) AS INTEGER) as hour, COUNT(*) as sessions
         FROM charging_sessions
         WHERE startTime >= datetime('now', '-24 hours')
         GROUP BY hour;`
      );

      const activityByHour = new Map<number, number>();
      for (const activity of recentActivity) {
        activityByHour.set(activity.hour, activity.sessions);
      }

      // Generate forecast for next 24 hours
      const now = new Date();
      const currentHour = now.getHours();
      const forecast: Array<{ hour: number; forecastLoadKw: number; forecastEnergyKwh: number }> = [];

      for (let h = 0; h < 24; h++) {
        const forecastHour = (currentHour + h) % 24;
        
        // Time-of-day pattern: higher load during charging window (22:00-06:00)
        const inChargingWindow = forecastHour >= 22 || forecastHour < 6;
        const baseMultiplier = inChargingWindow ? 1.2 : 0.6;
        
        // Use historical activity if available, otherwise use base multiplier
        const historicalSessions = activityByHour.get(forecastHour) ?? 0;
        const avgSessions = historicalSessions > 0 ? historicalSessions : (currentActive?.count ?? 0) * baseMultiplier;
        
        const forecastLoadKw = Math.round(avgSessions * 50);
        const forecastEnergyKwh = Math.round(forecastLoadKw * 1); // 1 hour at forecast load

        forecast.push({
          hour: forecastHour,
          forecastLoadKw,
          forecastEnergyKwh,
        });
      }

      return forecast;
    },

    async sumStationEnergy(timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "WHERE date(startTime, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "WHERE strftime('%Y-%m', startTime, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "WHERE strftime('%Y', startTime, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(energyAddedKwh), 0) as total FROM charging_sessions ${dateFilter};`
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumElectricityDelivered(timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "WHERE date(timestamp, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "WHERE strftime('%Y-%m', timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "WHERE strftime('%Y', timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(energyCharge), 0) as total FROM receipts ${dateFilter};`
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async sumEeuRevenueShare(timeframe: "daily" | "monthly" | "yearly"): Promise<number> {
      let dateFilter = "";
      if (timeframe === "daily") {
        dateFilter = "WHERE date(timestamp, 'localtime') = date('now', 'localtime')";
      } else if (timeframe === "monthly") {
        dateFilter = "WHERE strftime('%Y-%m', timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
      } else if (timeframe === "yearly") {
        dateFilter = "WHERE strftime('%Y', timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')";
      }

      const row = await getQuery<SumRow>(
        `SELECT COALESCE(SUM(eeuShare), 0) as total FROM receipts ${dateFilter};`
      );
      return Number((row?.total ?? 0).toFixed(2));
    },

    async countActiveChargingSessions(): Promise<number> {
      const row = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM charging_sessions WHERE status = 'ACTIVE';"
      );
      return row?.count ?? 0;
    },
  },
};

/**
 * Visibility-safe entity queries
 * These enforce role-based access control for entity lists
 */
export const scopedEntities = {
  /**
   * Get trucks with visibility rules
   */
  async getTrucks(req: Request): Promise<any[]> {
    const role = req.user?.role;
    const orgId = getOrganizationId(req);

    if (isAdminOrA2Operator(req)) {
      // Full access
      return allQuery("SELECT * FROM trucks ORDER BY id ASC;");
    }

    if (role === "FLEET_OWNER" && orgId) {
      // Own fleet only
      return allQuery("SELECT * FROM trucks WHERE fleetId = ? ORDER BY id ASC;", [orgId]);
    }

    if (role === "STATION_OPERATOR" || role === "DRIVER" || role === "FREIGHT_CUSTOMER" || role === "EEU_OPERATOR") {
      // Context access only (for maps, not detailed operational data)
      // Return limited fields for context
      return allQuery(
        "SELECT id, plateNumber, status, currentStationId, locationLat, locationLng FROM trucks ORDER BY id ASC;"
      );
    }

    return [];
  },

  /**
   * Get drivers with visibility rules
   */
  async getDrivers(req: Request): Promise<any[]> {
    const role = req.user?.role;
    const orgId = getOrganizationId(req);

    if (isAdminOrA2Operator(req)) {
      // Full access
      return allQuery("SELECT * FROM drivers ORDER BY id ASC;");
    }

    if (role === "FLEET_OWNER" && orgId) {
      // Own fleet only
      return allQuery("SELECT * FROM drivers WHERE fleetId = ? ORDER BY id ASC;", [orgId]);
    }

    if (role === "DRIVER" && orgId) {
      // Own profile only
      return allQuery("SELECT * FROM drivers WHERE id = ?;", [orgId]);
    }

    // EEU, Station, Freight cannot see driver details
    return [];
  },

  /**
   * Get batteries with visibility rules
   */
  async getBatteries(req: Request): Promise<any[]> {
    const role = req.user?.role;
    const orgId = getOrganizationId(req);

    if (isAdminOrA2Operator(req)) {
      // Full access
      return allQuery("SELECT * FROM batteries ORDER BY id ASC;");
    }

    if (role === "STATION_OPERATOR" && orgId) {
      // Own station only
      return allQuery("SELECT * FROM batteries WHERE stationId = ? ORDER BY id ASC;", [orgId]);
    }

    if (role === "FLEET_OWNER" || role === "DRIVER" || role === "FREIGHT_CUSTOMER" || role === "EEU_OPERATOR") {
      // Context access only (for battery ID lookup, not operational control)
      // Return limited fields
      return allQuery(
        "SELECT id, status, soc, stationId, truckId FROM batteries ORDER BY id ASC;"
      );
    }

    return [];
  },

  /**
   * Get shipments with visibility rules
   */
  async getShipments(req: Request): Promise<any[]> {
    const role = req.user?.role;
    const orgId = getOrganizationId(req);

    if (isAdminOrA2Operator(req)) {
      // Full access
      return allQuery("SELECT * FROM shipments ORDER BY id DESC;");
    }

    if (role === "FREIGHT_CUSTOMER" && orgId) {
      // Own shipments only
      return allQuery("SELECT * FROM shipments WHERE customerId = ? ORDER BY id DESC;", [orgId]);
    }

    if (role === "FLEET_OWNER" && orgId) {
      // Own fleet's shipments (via truck assignment)
      return allQuery(
        `SELECT s.* FROM shipments s
         JOIN trucks t ON s.truckId = t.id
         WHERE t.fleetId = ?
         ORDER BY s.id DESC;`,
        [orgId]
      );
    }

    if (role === "DRIVER" && orgId) {
      // Own shipments only
      return allQuery("SELECT * FROM shipments WHERE driverId = ? ORDER BY id DESC;", [orgId]);
    }

    // Station, EEU cannot see shipments
    return [];
  },

  /**
   * Get swaps with visibility rules
   */
  async getSwaps(req: Request): Promise<any[]> {
    const role = req.user?.role;
    const orgId = getOrganizationId(req);

    if (isAdminOrA2Operator(req)) {
      // Full access
      return allQuery("SELECT * FROM swap_transactions ORDER BY timestamp DESC;");
    }

    if (role === "STATION_OPERATOR" && orgId) {
      // Own station only
      return allQuery(
        "SELECT * FROM swap_transactions WHERE stationId = ? ORDER BY timestamp DESC;",
        [orgId]
      );
    }

    if (role === "FLEET_OWNER" && orgId) {
      // Own fleet's swaps (via truck assignment)
      return allQuery(
        `SELECT st.* FROM swap_transactions st
         JOIN trucks t ON st.truckId = t.id
         WHERE t.fleetId = ?
         ORDER BY st.timestamp DESC;`,
        [orgId]
      );
    }

    if (role === "DRIVER" && orgId) {
      // Own swaps (via assigned truck)
      return allQuery(
        `SELECT st.* FROM swap_transactions st
         JOIN drivers d ON st.truckId = d.assignedTruckId
         WHERE d.id = ?
         ORDER BY st.timestamp DESC;`,
        [orgId]
      );
    }

    // Freight, EEU cannot see swaps
    return [];
  },

  /**
   * Get stations with visibility rules
   */
  async getStations(req: Request): Promise<any[]> {
    // All roles can see stations (for context/navigation)
    return allQuery("SELECT * FROM stations ORDER BY id ASC;");
  },
};
