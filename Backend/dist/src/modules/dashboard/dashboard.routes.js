"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const scoped_queries_1 = require("../../services/scoped-queries");
const connection_1 = require("../../database/connection");
const dashboardRouter = (0, express_1.Router)();
async function count(sql, params = []) {
    const row = await (0, connection_1.getQuery)(sql, params);
    return row?.count ?? 0;
}
async function sum(sql, params = []) {
    const row = await (0, connection_1.getQuery)(sql, params);
    return Number((row?.total ?? 0).toFixed(2));
}
dashboardRouter.get("/dashboard/a2", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        // Use scoped queries for A2 (full system access)
        const activeTrucks = await scoped_queries_1.scopedQueries.a2.countActiveTrucks();
        const swapsToday = await scoped_queries_1.scopedQueries.a2.countSwapsToday();
        const batteriesReady = await scoped_queries_1.scopedQueries.a2.countBatteriesReady();
        const chargingActive = await scoped_queries_1.scopedQueries.a2.countChargingActive();
        const corridorEnergyToday = await scoped_queries_1.scopedQueries.a2.sumCorridorEnergyToday();
        const corridorRevenue = await scoped_queries_1.scopedQueries.a2.sumCorridorRevenue();
        const a2Share = await scoped_queries_1.scopedQueries.a2.sumA2Share();
        const eeuShare = await scoped_queries_1.scopedQueries.a2.sumEeuShare();
        const vatCollected = await scoped_queries_1.scopedQueries.a2.sumVatCollected();
        const stationsOnline = await scoped_queries_1.scopedQueries.a2.countStationsOnline();
        res.status(200).json({
            activeTrucks,
            swapsToday,
            batteriesReady,
            chargingActive,
            corridorEnergyToday,
            corridorRevenue,
            a2Share,
            eeuShare,
            vatCollected,
            stationsOnline,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/a2/system-health", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const stationsOnline = await scoped_queries_1.scopedQueries.a2.countStationsOnline();
        const stationsOffline = await count("SELECT COUNT(*) as count FROM stations WHERE status = 'INACTIVE';");
        const trucksActive = await scoped_queries_1.scopedQueries.a2.countActiveTrucks();
        const trucksIdle = await count("SELECT COUNT(*) as count FROM trucks WHERE status = 'IDLE';");
        const trucksMaintenance = await count("SELECT COUNT(*) as count FROM trucks WHERE status = 'MAINTENANCE';");
        const driversActive = await count("SELECT COUNT(*) as count FROM drivers WHERE status IN ('ACTIVE', 'ON_DUTY');");
        const driversInactive = await count("SELECT COUNT(*) as count FROM drivers WHERE status IN ('AVAILABLE', 'RESTING');");
        // Network utilization: percentage of active trucks vs total trucks
        const totalTrucks = await count("SELECT COUNT(*) as count FROM trucks;");
        const networkUtilization = totalTrucks > 0
            ? Number(((trucksActive / totalTrucks) * 100).toFixed(2))
            : 0;
        res.status(200).json({
            stationsOnline,
            stationsOffline,
            trucksActive,
            trucksIdle,
            trucksMaintenance,
            driversActive,
            driversInactive,
            networkUtilization,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/station/:id", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        if (Number.isNaN(stationId)) {
            res.status(400).json({ error: "Invalid station id" });
            return;
        }
        // Enforce visibility: station operators can only see their own station
        const userOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
        if (req.user?.role === "STATION_OPERATOR" && (userOrgId === null || userOrgId !== stationId)) {
            res.status(403).json({
                error: "Forbidden: Cannot access other station's data",
                message: userOrgId === null
                    ? "Your account is not linked to a station. Please contact an administrator."
                    : `You can only access station ${userOrgId}, not station ${stationId}`
            });
            return;
        }
        const station = await (0, connection_1.getQuery)("SELECT id, name, status FROM stations WHERE id = ?;", [stationId]);
        if (!station) {
            res.status(404).json({ error: "Station not found" });
            return;
        }
        // Temporarily set organizationId for scoped queries
        const originalOrgId = req.user?.organizationId;
        if (req.user) {
            req.user.organizationId = String(stationId);
        }
        const batteriesAtStation = await scoped_queries_1.scopedQueries.station.countTotalBatteries(req);
        const activeChargingSessions = await count("SELECT COUNT(*) as count FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';", [stationId]);
        const swapsToday = await scoped_queries_1.scopedQueries.station.countSwapsToday(req);
        const energyToday = await scoped_queries_1.scopedQueries.station.sumEnergyConsumedToday(req);
        // Revenue tracking
        const revenueTodayEtb = await scoped_queries_1.scopedQueries.station.sumRevenueToday(req);
        const revenueThisMonthEtb = await scoped_queries_1.scopedQueries.station.sumRevenueThisMonth(req);
        // Energy tracking
        const energyChargingNowKwh = await scoped_queries_1.scopedQueries.station.sumEnergyChargingNow(req);
        // Charger status - realistic count based on batteries and station size
        // Scaled for 1000 trucks: small stations max 50, medium max 100, large max 150
        const batteryCount = await count("SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;", [stationId]);
        const stationData = await (0, connection_1.getQuery)("SELECT capacity FROM stations WHERE id = ?;", [stationId]);
        const stationCapacity = stationData?.capacity ?? 20;
        let maxChargers;
        if (stationCapacity <= 18) {
            maxChargers = 50; // Small stations
        }
        else if (stationCapacity <= 25) {
            maxChargers = 100; // Medium stations
        }
        else {
            maxChargers = 150; // Large stations
        }
        const realisticChargerCount = Math.max(10, Math.min(maxChargers, Math.ceil(batteryCount / 3.5)));
        const chargingSessions = await (0, connection_1.allQuery)(`SELECT id, batteryId, currentSoc, targetSoc, energyAddedKwh
       FROM charging_sessions
       WHERE stationId = ? AND status = 'ACTIVE'
       ORDER BY id ASC
       LIMIT ?;`, [stationId, realisticChargerCount]);
        const chargerStatus = chargingSessions.map((session, index) => ({
            chargerId: `CHG-${String(index + 1).padStart(2, "0")}`,
            status: "ACTIVE",
            outputKw: 50, // Default charger output
            batteryId: session.batteryId,
            currentSoc: session.currentSoc,
            targetSoc: session.targetSoc,
            energyAddedKwh: session.energyAddedKwh,
        }));
        // Add ready chargers (up to realistic total)
        for (let i = chargerStatus.length; i < realisticChargerCount; i++) {
            chargerStatus.push({
                chargerId: `CHG-${String(i + 1).padStart(2, "0")}`,
                status: "READY",
                outputKw: 0,
                batteryId: null,
                currentSoc: null,
                targetSoc: null,
                energyAddedKwh: 0,
            });
        }
        // Incoming truck predictions
        let incomingPredictions = [];
        try {
            // Get station coordinates (from locationLat/locationLng or fallback to name-based lookup)
            const stationData = await (0, connection_1.getQuery)("SELECT locationLat, locationLng, name FROM stations WHERE id = ?;", [stationId]);
            // Fallback to hardcoded coordinates if not in DB
            const stationCoordinateByName = {
                "Addis Ababa (Main Hub)": { lat: 8.9806, lng: 38.7578 },
                "Adama": { lat: 8.54, lng: 39.27 },
                "Awash": { lat: 8.98, lng: 40.17 },
                "Mieso": { lat: 9.24, lng: 40.75 },
                "Dire Dawa": { lat: 9.6, lng: 41.86 },
                "Semera / Mille area": { lat: 11.79, lng: 41.01 },
                "Djibouti Port Gateway": { lat: 11.58, lng: 43.15 },
            };
            const stationLat = stationData?.locationLat ?? stationCoordinateByName[stationData?.name ?? ""]?.lat;
            const stationLng = stationData?.locationLng ?? stationCoordinateByName[stationData?.name ?? ""]?.lng;
            if (stationLat && stationLng) {
                const incomingTrucks = await (0, connection_1.allQuery)(`SELECT id, plateNumber, locationLat, locationLng, currentSoc, status
           FROM trucks
           WHERE status = 'IN_TRANSIT'
             AND locationLat IS NOT NULL
             AND locationLng IS NOT NULL
           LIMIT 20;`);
                incomingPredictions = incomingTrucks
                    .map((truck) => {
                    if (!truck.locationLat || !truck.locationLng) {
                        return null;
                    }
                    // Calculate distance (simplified haversine)
                    const lat1 = stationLat;
                    const lon1 = stationLng;
                    const lat2 = truck.locationLat;
                    const lon2 = truck.locationLng;
                    const R = 6371; // Earth's radius in km
                    const dLat = ((lat2 - lat1) * Math.PI) / 180;
                    const dLon = ((lon2 - lon1) * Math.PI) / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos((lat1 * Math.PI) / 180) *
                            Math.cos((lat2 * Math.PI) / 180) *
                            Math.sin(dLon / 2) *
                            Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distanceKm = R * c;
                    // Realistic ETA calculation (assuming average speed of 60 km/h)
                    const hoursToArrival = distanceKm / 60;
                    const estimatedMinutes = Math.round(hoursToArrival * 60);
                    // Realistic SOC estimation based on distance
                    // Base consumption: ~2 kWh per km, assume 588 kWh battery capacity
                    const batteryCapacityKwh = 588;
                    const baseEnergyKwh = distanceKm * 2.0;
                    const socDrop = (baseEnergyKwh / batteryCapacityKwh) * 100;
                    const estimatedSoc = Math.max(0, Math.round((truck.currentSoc || 0) - socDrop));
                    return {
                        truckId: truck.id,
                        truckLabel: truck.plateNumber || `TRK-${truck.id}`,
                        eta: estimatedMinutes > 0 ? `~${estimatedMinutes} min` : "Arriving",
                        estimatedSoc: Math.round(estimatedSoc),
                        distanceKm: Math.round(distanceKm * 10) / 10,
                    };
                })
                    .filter((item) => item !== null);
            }
        }
        catch (error) {
            // If there's an error calculating predictions, just return empty array
            console.error("Error calculating incoming predictions:", error);
            incomingPredictions = [];
        }
        // Queue size (handle case where swap_queue table might not exist yet)
        let queueSize = 0;
        try {
            queueSize = await count(`SELECT COUNT(*) as count
         FROM swap_queue
         WHERE stationId = ? AND status = 'PENDING';`, [stationId]);
        }
        catch (error) {
            // Table might not exist yet, ignore error
            queueSize = 0;
        }
        // Also count trucks at station waiting
        const trucksAtStationWaiting = await count(`SELECT COUNT(*) as count
       FROM trucks
       WHERE currentStationId = ? AND status = 'READY';`, [stationId]);
        const totalQueueSize = await scoped_queries_1.scopedQueries.station.countQueueSize(req);
        // Additional aggregates
        const readyBatteries = await scoped_queries_1.scopedQueries.station.countReadyBatteries(req);
        const chargingBatteries = await scoped_queries_1.scopedQueries.station.countChargingBatteries(req);
        // Battery inventory by status
        const batteryInventoryByStatus = {
            READY: await count("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'READY';", [stationId]),
            CHARGING: await count("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'CHARGING';", [stationId]),
            MAINTENANCE: await count("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'MAINTENANCE';", [stationId]),
            IN_TRUCK: await count("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'IN_TRUCK';", [stationId]),
        };
        // Batteries ready for swap (SOC >= 80%)
        const batteriesReadyForSwap = await (0, connection_1.allQuery)(`SELECT id, soc, health, cycleCount
         FROM batteries
         WHERE stationId = ? AND status = 'READY' AND soc >= 80
         ORDER BY soc DESC, id ASC
         LIMIT 50;`, [stationId]);
        // Active charging sessions list with full details
        const activeChargingSessionsList = await (0, connection_1.allQuery)(`SELECT id, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh
         FROM charging_sessions
         WHERE stationId = ? AND status = 'ACTIVE'
         ORDER BY id ASC;`, [stationId]);
        // Recent completed charging sessions (last 10)
        const recentCompletedChargingSessions = await (0, connection_1.allQuery)(`SELECT id, batteryId, startTime, endTime, energyAddedKwh
         FROM charging_sessions
         WHERE stationId = ? AND status = 'COMPLETED'
         ORDER BY endTime DESC
         LIMIT 10;`, [stationId]);
        // Recent swaps (last 10)
        const recentSwaps = await (0, connection_1.allQuery)(`SELECT id, truckId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp
         FROM swap_transactions
         WHERE stationId = ?
         ORDER BY timestamp DESC
         LIMIT 10;`, [stationId]);
        // Trucks currently at station
        const trucksCurrentlyAtStation = await (0, connection_1.allQuery)(`SELECT id, plateNumber, currentSoc, status, truckType
         FROM trucks
         WHERE currentStationId = ?
         ORDER BY id ASC;`, [stationId]);
        // Charger faults open
        const chargerFaultsOpen = await count(`SELECT COUNT(*) as count
         FROM charger_faults
         WHERE stationId = ? AND status = 'OPEN';`, [stationId]);
        // Restore original organizationId
        if (req.user && originalOrgId) {
            req.user.organizationId = originalOrgId;
        }
        res.status(200).json({
            stationId: station.id,
            stationName: station.name,
            stationStatus: station.status,
            batteriesAtStation,
            readyBatteries,
            chargingBatteries,
            batteryInventoryByStatus,
            activeChargingSessions,
            activeChargingSessionsList,
            batteriesReadyForSwap,
            swapsToday,
            recentSwaps,
            energyToday,
            revenueTodayEtb,
            revenueThisMonthEtb,
            energyChargingNowKwh,
            chargerStatus,
            recentCompletedChargingSessions,
            incomingPredictions,
            queueSize: totalQueueSize,
            trucksCurrentlyAtStation,
            chargerFaultsOpen,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/fleet/:id", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const fleetId = Number(req.params.id);
        if (Number.isNaN(fleetId)) {
            res.status(400).json({ error: "Invalid fleet id" });
            return;
        }
        // Enforce visibility: fleet owners can only see their own fleet
        const userOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
        if (req.user?.role === "FLEET_OWNER" && userOrgId !== fleetId) {
            res.status(403).json({ error: "Forbidden: Cannot access other fleet's data" });
            return;
        }
        const fleet = await (0, connection_1.getQuery)("SELECT id, name FROM fleets WHERE id = ?;", [fleetId]);
        if (!fleet) {
            res.status(404).json({ error: "Fleet not found" });
            return;
        }
        // Temporarily set organizationId for scoped queries
        const originalOrgId = req.user?.organizationId;
        if (req.user) {
            req.user.organizationId = String(fleetId);
        }
        const totalTrucks = await count("SELECT COUNT(*) as count FROM trucks WHERE fleetId = ?;", [
            fleetId,
        ]);
        const activeTrucks = await scoped_queries_1.scopedQueries.fleet.countActiveTrucks(req);
        const availableTrucks = await scoped_queries_1.scopedQueries.fleet.countAvailableTrucks(req);
        const activeDrivers = await scoped_queries_1.scopedQueries.fleet.countActiveDrivers(req);
        const swapsToday = await scoped_queries_1.scopedQueries.fleet.countSwapsToday(req);
        const fleetEnergyCostEtb = await scoped_queries_1.scopedQueries.fleet.sumFleetEnergyCost(req);
        const completedTrips = await scoped_queries_1.scopedQueries.fleet.countCompletedTrips(req);
        const maintenanceAlerts = await scoped_queries_1.scopedQueries.fleet.countMaintenanceAlerts(req);
        const refrigeratedTrucksActive = await scoped_queries_1.scopedQueries.fleet.countRefrigeratedActive(req);
        const availableDrivers = await count("SELECT COUNT(*) as count FROM drivers WHERE fleetId = ? AND status = 'AVAILABLE';", [fleetId]);
        const activeShipments = await count(`
      SELECT COUNT(*) as count
      FROM shipments s
      INNER JOIN trucks t ON t.id = s.truckId
      WHERE t.fleetId = ? AND s.status IN ('ASSIGNED', 'IN_TRANSIT');
    `, [fleetId]);
        // Restore original organizationId
        if (req.user && originalOrgId) {
            req.user.organizationId = originalOrgId;
        }
        res.status(200).json({
            fleetId: fleet.id,
            fleetName: fleet.name,
            totalTrucks,
            activeTrucks,
            availableTrucks,
            activeDrivers,
            swapsToday,
            fleetEnergyCostEtb,
            completedTrips,
            maintenanceAlerts,
            refrigeratedTrucksActive,
            availableDrivers,
            activeShipments,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/driver/:id", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["DRIVER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const driverId = Number(req.params.id);
        if (Number.isNaN(driverId)) {
            res.status(400).json({ error: "Invalid driver id" });
            return;
        }
        // Enforce visibility: drivers can only see their own profile
        const userOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
        if (req.user?.role === "DRIVER" && userOrgId !== driverId) {
            res.status(403).json({ error: "Forbidden: Cannot access other driver's data" });
            return;
        }
        const driver = await (0, connection_1.getQuery)("SELECT * FROM drivers WHERE id = ?;", [driverId]);
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
            tripEfficiency: driver.tripEfficiency,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/eeu", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["EEU_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || "daily";
        // Use scoped queries for EEU (energy data only)
        const totalNetworkLoad = await scoped_queries_1.scopedQueries.eeu.countTotalNetworkLoad();
        const stationEnergy = await scoped_queries_1.scopedQueries.eeu.sumStationEnergy(timeframe);
        const electricityDelivered = await scoped_queries_1.scopedQueries.eeu.sumElectricityDelivered(timeframe);
        const eeuRevenueShare = await scoped_queries_1.scopedQueries.eeu.sumEeuRevenueShare(timeframe);
        const activeChargingSessions = await scoped_queries_1.scopedQueries.eeu.countActiveChargingSessions();
        const activeStations = await count("SELECT COUNT(*) as count FROM stations WHERE status = 'ACTIVE';");
        // Get per-station active charger counts and loads
        const stationChargerCounts = await (0, connection_1.allQuery)(`SELECT stationId, COUNT(*) as activeChargers 
       FROM charging_sessions 
       WHERE status = 'ACTIVE' 
       GROUP BY stationId;`);
        // Get station loads
        const stationLoads = await scoped_queries_1.scopedQueries.eeu.getStationLoads();
        // Get peak load station
        const peakLoadStation = await scoped_queries_1.scopedQueries.eeu.getPeakLoadStation();
        // Generate 24-hour forecast
        const forecast24h = await scoped_queries_1.scopedQueries.eeu.generate24HourForecast();
        res.status(200).json({
            totalNetworkLoad,
            stationEnergy,
            electricityDelivered,
            eeuRevenueShare,
            activeChargingSessions,
            activeStations,
            stationChargerCounts,
            stationLoads,
            peakLoadStation,
            forecast24h,
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/freight/:customerId", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["FREIGHT_CUSTOMER", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const customerId = Number(req.params.customerId);
        if (Number.isNaN(customerId)) {
            res.status(400).json({ error: "Invalid customer id" });
            return;
        }
        // Enforce visibility: freight customers can only see their own shipments
        // For freight customers, organizationId should equal their user id
        if (req.user?.role === "FREIGHT_CUSTOMER") {
            const userCustomerId = req.user.id; // For freight customers, customerId = userId
            if (userCustomerId !== customerId) {
                res.status(403).json({
                    error: `Forbidden: Cannot access other customer's data. Your customer ID is ${userCustomerId}, but you're trying to access ${customerId}.`
                });
                return;
            }
        }
        const timeframe = req.query.timeframe || "daily";
        // Temporarily set organizationId for scoped queries
        const originalOrgId = req.user?.organizationId;
        if (req.user) {
            req.user.organizationId = String(customerId);
        }
        const totalShipments = await scoped_queries_1.scopedQueries.freight.countTotalShipments(req, timeframe);
        const activeShipments = await scoped_queries_1.scopedQueries.freight.countActiveShipments(req, timeframe);
        const deliveredShipments = await scoped_queries_1.scopedQueries.freight.countDeliveredShipments(req, timeframe);
        // Estimated spend calculation
        let dateFilter = "";
        if (timeframe === "daily") {
            dateFilter = "AND date(sh.assignedAt) = date('now')";
        }
        else if (timeframe === "monthly") {
            dateFilter = "AND date(sh.assignedAt) >= date('now', 'start of month')";
        }
        else if (timeframe === "yearly") {
            dateFilter = "AND date(sh.assignedAt) >= date('now', 'start of year')";
        }
        const estimatedSpend = await sum(`
      SELECT COALESCE(SUM(r.total), 0) as total
      FROM receipts r
      INNER JOIN swap_transactions s ON s.id = r.swapId
      INNER JOIN shipments sh ON sh.truckId = s.truckId
      WHERE sh.customerId = ? ${dateFilter};
    `, [customerId]);
        const recentShipmentActivity = await (0, connection_1.allQuery)(`
      SELECT sh.id, sh.status, se.eventType, se.message, se.timestamp
      FROM shipments sh
      LEFT JOIN shipment_events se ON se.shipmentId = sh.id
      WHERE sh.customerId = ?
      ORDER BY sh.id DESC, se.id DESC
      LIMIT 10;
    `, [customerId]);
        let dateFilterForShipments = "";
        if (timeframe === "daily") {
            dateFilterForShipments = "AND date(assignedAt, 'localtime') = date('now', 'localtime')";
        }
        else if (timeframe === "monthly") {
            dateFilterForShipments = "AND date(assignedAt) >= date('now', 'start of month')";
        }
        else if (timeframe === "yearly") {
            dateFilterForShipments = "AND date(assignedAt) >= date('now', 'start of year')";
        }
        const deliveryConfirmations = await count(`SELECT COUNT(*) as count FROM shipments WHERE customerId = ? AND deliveryConfirmedAt IS NOT NULL ${dateFilterForShipments};`, [customerId]);
        // Restore original organizationId
        if (req.user && originalOrgId) {
            req.user.organizationId = originalOrgId;
        }
        res.status(200).json({
            customerId,
            totalShipments,
            activeShipments,
            deliveredShipments,
            estimatedSpend,
            recentShipmentActivity,
            deliveryConfirmations,
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
dashboardRouter.get("/dashboard/a2/live-feed", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const swaps = await (0, connection_1.allQuery)("SELECT id, truckId, stationId, energyDeliveredKwh, timestamp FROM swap_transactions ORDER BY id DESC LIMIT 10;");
        const chargingStarts = await (0, connection_1.allQuery)("SELECT id, stationId, batteryId, startTime, status FROM charging_sessions ORDER BY id DESC LIMIT 10;");
        const chargingCompletions = await (0, connection_1.allQuery)("SELECT id, stationId, batteryId, endTime, energyAddedKwh, status FROM charging_sessions WHERE status = 'COMPLETED' ORDER BY id DESC LIMIT 10;");
        const incidents = await (0, connection_1.allQuery)("SELECT id, stationId, type, severity, message, status, reportedAt FROM station_incidents ORDER BY id DESC LIMIT 10;");
        const chargerFaults = await (0, connection_1.allQuery)("SELECT id, stationId, chargerId, faultCode, message, status, reportedAt, resolvedAt FROM charger_faults ORDER BY id DESC LIMIT 10;");
        const freightAssignments = await (0, connection_1.allQuery)("SELECT id, truckId, driverId, status, assignedAt FROM shipments WHERE assignedAt IS NOT NULL ORDER BY id DESC LIMIT 10;");
        const truckArrivals = await (0, connection_1.allQuery)("SELECT id, stationId, truckId, driverId, arrivedAt FROM truck_arrivals ORDER BY id DESC LIMIT 10;");
        res.status(200).json({
            swaps,
            chargingStarts,
            chargingCompletions,
            incidents,
            chargerFaults,
            freightAssignments,
            truckArrivals,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = dashboardRouter;
