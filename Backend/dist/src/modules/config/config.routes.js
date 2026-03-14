"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const requireAuth_1 = require("../../middleware/requireAuth");
const auth_service_1 = require("../auth/auth.service");
const connection_1 = require("../../database/connection");
const accessControl_1 = require("../../utils/accessControl");
const configRouter = (0, express_1.Router)();
configRouter.get("/config/tariffs", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const tariffs = await (0, connection_1.getQuery)(`
        SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent
        FROM tariff_config
        WHERE id = 1;
      `);
        res.status(200).json({ tariffs });
    }
    catch (error) {
        next(error);
    }
});
configRouter.patch("/config/tariffs", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const { eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent } = req.body;
        if (eeuRatePerKwh === undefined ||
            a2ServiceRatePerKwh === undefined ||
            vatPercent === undefined) {
            res.status(400).json({
                error: "eeuRatePerKwh, a2ServiceRatePerKwh and vatPercent are required"
            });
            return;
        }
        await (0, connection_1.runQuery)(`
        UPDATE tariff_config
        SET eeuRatePerKwh = ?, a2ServiceRatePerKwh = ?, vatPercent = ?
        WHERE id = 1;
      `, [eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent]);
        const tariffs = await (0, connection_1.getQuery)(`
        SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent
        FROM tariff_config
        WHERE id = 1;
      `);
        res.status(200).json({ tariffs });
    }
    catch (error) {
        next(error);
    }
});
configRouter.get("/config/charging-windows", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const windowConfig = await (0, connection_1.getQuery)(`
        SELECT startHour, endHour, label
        FROM charging_window_config
        WHERE id = 1;
      `);
        res.status(200).json({ chargingWindow: windowConfig });
    }
    catch (error) {
        next(error);
    }
});
configRouter.patch("/config/charging-windows", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const { startHour, endHour, label } = req.body;
        if (startHour === undefined || endHour === undefined || !label) {
            res.status(400).json({ error: "startHour, endHour and label are required" });
            return;
        }
        if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
            res.status(400).json({ error: "startHour and endHour must be between 0 and 23" });
            return;
        }
        await (0, connection_1.runQuery)(`
        UPDATE charging_window_config
        SET startHour = ?, endHour = ?, label = ?
        WHERE id = 1;
      `, [startHour, endHour, label]);
        const windowConfig = await (0, connection_1.getQuery)(`
        SELECT startHour, endHour, label
        FROM charging_window_config
        WHERE id = 1;
      `);
        res.status(200).json({ chargingWindow: windowConfig });
    }
    catch (error) {
        next(error);
    }
});
configRouter.patch("/stations/:id/config", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        const { maxQueueSize, swapBayCount, overnightChargingEnabled, incidentThreshold, operatingStatus } = req.body;
        if (Number.isNaN(stationId)) {
            res.status(400).json({ error: "Invalid station id" });
            return;
        }
        if (maxQueueSize === undefined ||
            swapBayCount === undefined ||
            overnightChargingEnabled === undefined ||
            incidentThreshold === undefined ||
            !operatingStatus) {
            res.status(400).json({
                error: "maxQueueSize, swapBayCount, overnightChargingEnabled, incidentThreshold and operatingStatus are required"
            });
            return;
        }
        const station = await (0, connection_1.getQuery)("SELECT id FROM stations WHERE id = ?;", [
            stationId
        ]);
        if (!station) {
            res.status(404).json({ error: "Station not found" });
            return;
        }
        await (0, connection_1.runQuery)(`
        UPDATE stations
        SET maxQueueSize = ?, swapBayCount = ?, overnightChargingEnabled = ?, incidentThreshold = ?, operatingStatus = ?
        WHERE id = ?;
      `, [
            maxQueueSize,
            swapBayCount,
            overnightChargingEnabled ? 1 : 0,
            incidentThreshold,
            operatingStatus,
            stationId
        ]);
        const updated = await (0, connection_1.getQuery)(`
        SELECT id, name, maxQueueSize, swapBayCount, overnightChargingEnabled, incidentThreshold, operatingStatus
        FROM stations WHERE id = ?;
      `, [stationId]);
        res.status(200).json({ stationConfig: updated });
    }
    catch (error) {
        next(error);
    }
});
configRouter.get("/users", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const users = await (0, connection_1.allQuery)("SELECT id, name, email, role, organizationId, createdAt FROM users ORDER BY id;");
        res.status(200).json({ users });
    }
    catch (error) {
        next(error);
    }
});
configRouter.patch("/users/:id/role", requireAuth_1.requireAuth, async (req, res, next) => {
    try {
        if (req.user?.role !== "ADMIN") {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        const userId = Number(req.params.id);
        const { role } = req.body;
        if (Number.isNaN(userId) || !role) {
            res.status(400).json({ error: "Valid user id and role are required" });
            return;
        }
        if (!(0, auth_service_1.isValidRole)(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }
        const existing = await (0, connection_1.getQuery)("SELECT id FROM users WHERE id = ?;", [userId]);
        if (!existing) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        await (0, connection_1.runQuery)("UPDATE users SET role = ? WHERE id = ?;", [role, userId]);
        const updated = await (0, connection_1.getQuery)("SELECT id, name, email, role, organizationId, createdAt FROM users WHERE id = ?;", [userId]);
        res.status(200).json({ user: updated });
    }
    catch (error) {
        next(error);
    }
});
configRouter.post("/stations/:id/incidents", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        const { type, severity, message, status } = req.body;
        if (Number.isNaN(stationId) || !type || !severity || !message || !status) {
            res.status(400).json({ error: "type, severity, message and status are required" });
            return;
        }
        if (req.user?.role === "STATION_OPERATOR") {
            const orgStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (orgStationId !== stationId) {
                res.status(403).json({ error: "Forbidden for station ownership" });
                return;
            }
        }
        const reportedAt = new Date().toISOString();
        const result = await (0, connection_1.runQuery)(`
      INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [stationId, type, severity, message, status, reportedAt]);
        const incident = await (0, connection_1.getQuery)("SELECT * FROM station_incidents WHERE id = ?;", [result.lastID]);
        res.status(201).json({ incident });
    }
    catch (error) {
        next(error);
    }
});
configRouter.get("/stations/:id/incidents", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        if (Number.isNaN(stationId)) {
            res.status(400).json({ error: "Invalid station id" });
            return;
        }
        if (req.user?.role === "STATION_OPERATOR") {
            const orgStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (orgStationId !== stationId) {
                res.status(403).json({ error: "Forbidden for station ownership" });
                return;
            }
        }
        const incidents = await (0, connection_1.allQuery)("SELECT * FROM station_incidents WHERE stationId = ? ORDER BY id DESC;", [stationId]);
        res.status(200).json({ incidents });
    }
    catch (error) {
        next(error);
    }
});
configRouter.post("/stations/:id/charger-faults", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        const { chargerId, faultCode, message, status } = req.body;
        if (Number.isNaN(stationId) || !chargerId || !faultCode || !message || !status) {
            res.status(400).json({
                error: "chargerId, faultCode, message and status are required"
            });
            return;
        }
        if (req.user?.role === "STATION_OPERATOR") {
            const orgStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (orgStationId !== stationId) {
                res.status(403).json({ error: "Forbidden for station ownership" });
                return;
            }
        }
        const reportedAt = new Date().toISOString();
        const result = await (0, connection_1.runQuery)(`
      INSERT INTO charger_faults (stationId, chargerId, faultCode, message, status, reportedAt)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [stationId, chargerId, faultCode, message, status, reportedAt]);
        const chargerFault = await (0, connection_1.getQuery)("SELECT * FROM charger_faults WHERE id = ?;", [
            result.lastID
        ]);
        res.status(201).json({ chargerFault });
    }
    catch (error) {
        next(error);
    }
});
configRouter.get("/stations/:id/charger-faults", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const stationId = Number(req.params.id);
        if (Number.isNaN(stationId)) {
            res.status(400).json({ error: "Invalid station id" });
            return;
        }
        if (req.user?.role === "STATION_OPERATOR") {
            const orgStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
            if (orgStationId !== stationId) {
                res.status(403).json({ error: "Forbidden for station ownership" });
                return;
            }
        }
        const chargerFaults = await (0, connection_1.allQuery)("SELECT * FROM charger_faults WHERE stationId = ? ORDER BY id DESC;", [stationId]);
        res.status(200).json({ chargerFaults });
    }
    catch (error) {
        next(error);
    }
});
configRouter.post("/demo/reset", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM battery_events;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM shipment_events;");
        await (0, connection_1.runQuery)("DELETE FROM shipments;");
        await (0, connection_1.runQuery)("DELETE FROM truck_arrivals;");
        await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
        await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
        await (0, connection_1.runQuery)("DELETE FROM driver_telemetry;");
        await (0, connection_1.runQuery)("DELETE FROM trucks;");
        await (0, connection_1.runQuery)("DELETE FROM drivers;");
        await (0, connection_1.runQuery)("DELETE FROM fleets;");
        await (0, connection_1.runQuery)("DELETE FROM stations;");
        res.status(200).json({ status: "ok", message: "Demo reset completed" });
    }
    catch (error) {
        next(error);
    }
});
configRouter.post("/demo/seed", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const { seedDemoData } = await Promise.resolve().then(() => __importStar(require("../../database/seed")));
        await seedDemoData();
        res.status(200).json({ status: "ok", message: "Demo seed completed" });
    }
    catch (error) {
        next(error);
    }
});
configRouter.post("/demo/scenario/:name", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const scenarioName = String(req.params.name);
        if (!(0, accessControl_1.isAdminOrA2Operator)(req)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        const now = new Date().toISOString();
        async function ensureDemoBatteries() {
            const batteryCount = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM batteries;");
            if ((batteryCount?.count ?? 0) > 0) {
                return;
            }
            const trucks = await (0, connection_1.allQuery)("SELECT id FROM trucks ORDER BY id ASC LIMIT 120;");
            const stations = await (0, connection_1.allQuery)("SELECT id FROM stations ORDER BY id ASC;");
            for (const truck of trucks) {
                await (0, connection_1.runQuery)(`
          INSERT INTO batteries
          (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
          VALUES (320, 70, 96, 120, 27, 'IN_TRUCK', NULL, ?);
        `, [truck.id]);
            }
            for (const station of stations) {
                for (let index = 0; index < 10; index += 1) {
                    const status = index < 7 ? "READY" : "CHARGING";
                    const soc = status === "READY" ? 90 - index : 40 + index;
                    await (0, connection_1.runQuery)(`
            INSERT INTO batteries
            (capacityKwh, soc, health, cycleCount, temperature, status, stationId, truckId)
            VALUES (320, ?, 95, 80, 28, ?, ?, NULL);
          `, [soc, status, station.id]);
                }
            }
        }
        async function createSyntheticSwapEntries(limit) {
            const stations = await (0, connection_1.allQuery)("SELECT id FROM stations ORDER BY id ASC;");
            const trucks = await (0, connection_1.allQuery)("SELECT id FROM trucks ORDER BY id ASC LIMIT ?;", [Math.max(limit * 4, 40)]);
            if (!stations.length || !trucks.length) {
                return 0;
            }
            let created = 0;
            let stationCursor = 0;
            for (const truck of trucks) {
                if (created >= limit) {
                    break;
                }
                const stationId = stations[stationCursor % stations.length].id;
                stationCursor += 1;
                const outgoingBattery = await (0, connection_1.getQuery)("SELECT id FROM batteries WHERE truckId = ? LIMIT 1;", [truck.id]);
                const incomingBattery = await (0, connection_1.getQuery)("SELECT id FROM batteries WHERE stationId = ? AND status = 'READY' LIMIT 1;", [stationId]);
                if (!outgoingBattery || !incomingBattery) {
                    continue;
                }
                const arrivalSoc = 28;
                const energyDeliveredKwh = 115;
                const swapInsert = await (0, connection_1.runQuery)(`
          INSERT INTO swap_transactions
          (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?);
        `, [
                    truck.id,
                    stationId,
                    incomingBattery.id,
                    outgoingBattery.id,
                    arrivalSoc,
                    energyDeliveredKwh,
                    now
                ]);
                await (0, connection_1.runQuery)("UPDATE batteries SET truckId = NULL, stationId = ?, status = 'CHARGING', soc = ? WHERE id = ?;", [stationId, arrivalSoc, outgoingBattery.id]);
                await (0, connection_1.runQuery)("UPDATE batteries SET truckId = ?, stationId = NULL, status = 'IN_TRUCK', soc = 92 WHERE id = ?;", [truck.id, incomingBattery.id]);
                await (0, connection_1.runQuery)("UPDATE trucks SET status = 'IN_TRANSIT', availability = 'ACTIVE', currentSoc = 92 WHERE id = ?;", [truck.id]);
                const energyCharge = 1150;
                const serviceCharge = 690;
                const vat = 276;
                const total = 2116;
                const eeuShare = 1288;
                const a2Share = 828;
                await (0, connection_1.runQuery)(`
          INSERT INTO receipts
          (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `, [
                    swapInsert.lastID,
                    energyDeliveredKwh,
                    energyCharge,
                    serviceCharge,
                    vat,
                    total,
                    eeuShare,
                    a2Share,
                    now
                ]);
                created += 1;
            }
            return created;
        }
        if (scenarioName === "charger-fault") {
            const station = await (0, connection_1.getQuery)("SELECT id FROM stations ORDER BY id ASC LIMIT 1;");
            if (!station) {
                res.status(400).json({ error: "No station available for scenario" });
                return;
            }
            await (0, connection_1.runQuery)(`
        INSERT INTO charger_faults (stationId, chargerId, faultCode, message, status, reportedAt)
        VALUES (?, 'CH-01', 'E-FAULT', 'Injected scenario fault', 'OPEN', ?);
      `, [station.id, now]);
            res.status(200).json({ status: "ok", scenario: scenarioName });
            return;
        }
        if (!["morning-operations", "station-congestion", "refrigerated-priority-load"].includes(scenarioName)) {
            res.status(400).json({ error: "Unsupported scenario name" });
            return;
        }
        await ensureDemoBatteries();
        if (scenarioName === "morning-operations") {
            await (0, connection_1.runQuery)(`
        UPDATE trucks
        SET status = 'IN_TRANSIT',
            availability = 'ACTIVE',
            currentSoc = CASE WHEN currentSoc > 20 THEN currentSoc - 12 ELSE currentSoc END
        WHERE id IN (SELECT id FROM trucks ORDER BY id ASC LIMIT 35);
      `);
            const createdSwaps = await createSyntheticSwapEntries(10);
            const chargingTargets = await (0, connection_1.allQuery)("SELECT id, stationId FROM batteries WHERE status = 'CHARGING' AND stationId IS NOT NULL ORDER BY id DESC LIMIT 8;");
            for (const battery of chargingTargets) {
                await (0, connection_1.runQuery)(`
          INSERT INTO charging_sessions (stationId, batteryId, startTime, status)
          VALUES (?, ?, ?, 'ACTIVE');
        `, [battery.stationId, battery.id, now]);
            }
            const morningArrivals = await (0, connection_1.allQuery)(`
        SELECT t.id as truckId, d.id as driverId, s.id as stationId
        FROM trucks t
        INNER JOIN drivers d ON d.fleetId = t.fleetId
        CROSS JOIN stations s
        ORDER BY t.id ASC, d.id ASC, s.id ASC
        LIMIT 10;
      `);
            for (const arrival of morningArrivals) {
                await (0, connection_1.runQuery)("INSERT INTO truck_arrivals (stationId, truckId, driverId, arrivedAt) VALUES (?, ?, ?, ?);", [arrival.stationId, arrival.truckId, arrival.driverId, now]);
            }
            res.status(200).json({
                status: "ok",
                scenario: scenarioName,
                message: "Morning operations surge injected",
                createdSwaps
            });
            return;
        }
        if (scenarioName === "station-congestion") {
            const station = await (0, connection_1.getQuery)("SELECT id FROM stations ORDER BY id ASC LIMIT 1;");
            if (!station) {
                res.status(400).json({ error: "No station available for scenario" });
                return;
            }
            await (0, connection_1.runQuery)(`
        UPDATE trucks
        SET currentStationId = ?, status = 'IDLE', availability = 'AVAILABLE'
        WHERE id IN (SELECT id FROM trucks ORDER BY id ASC LIMIT 25);
      `, [station.id]);
            for (let index = 0; index < 6; index += 1) {
                await (0, connection_1.runQuery)(`
          INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt)
          VALUES (?, 'QUEUE_CONGESTION', 'HIGH', ?, 'OPEN', ?);
        `, [station.id, `Queue pressure wave ${index + 1} detected`, now]);
            }
            const congestionArrivals = await (0, connection_1.allQuery)(`
        SELECT t.id as truckId, d.id as driverId
        FROM trucks t
        INNER JOIN drivers d ON d.fleetId = t.fleetId
        ORDER BY t.id ASC, d.id ASC
        LIMIT 12;
      `);
            for (const arrival of congestionArrivals) {
                await (0, connection_1.runQuery)("INSERT INTO truck_arrivals (stationId, truckId, driverId, arrivedAt) VALUES (?, ?, ?, ?);", [station.id, arrival.truckId, arrival.driverId, now]);
            }
            res.status(200).json({
                status: "ok",
                scenario: scenarioName,
                message: "Station congestion scenario injected"
            });
            return;
        }
        if (scenarioName === "refrigerated-priority-load") {
            await (0, connection_1.runQuery)(`
        UPDATE trucks
        SET status = 'IN_TRANSIT',
            availability = 'ACTIVE',
            currentSoc = CASE WHEN currentSoc > 30 THEN currentSoc - 18 ELSE currentSoc END,
            temperatureTarget = 2,
            temperatureCurrent = 3
        WHERE truckType = 'REFRIGERATED';
      `);
            await (0, connection_1.runQuery)(`
        INSERT INTO shipments
        (pickupLocation, deliveryLocation, cargoDescription, weight, volume, pickupWindow, requiresRefrigeration, temperatureTarget, customerId, truckId, driverId, approvedLoad, assignedAt, acceptedAt, pickupConfirmedAt, status)
        SELECT
          'Adama Cold Hub',
          'Dire Dawa Cold Store',
          'Temperature-sensitive medical goods',
          6.5,
          14.0,
          '06:00-09:00',
          1,
          2,
          1,
          t.id,
          d.id,
          1,
          ?,
          ?,
          ?,
          'IN_TRANSIT'
        FROM trucks t
        LEFT JOIN drivers d ON d.assignedTruckId = t.id
        WHERE t.truckType = 'REFRIGERATED'
        ORDER BY t.id ASC
        LIMIT 5;
      `, [now, now, now]);
            const createdSwaps = await createSyntheticSwapEntries(6);
            res.status(200).json({
                status: "ok",
                scenario: scenarioName,
                message: "Refrigerated priority load injected",
                createdSwaps
            });
            return;
        }
        res.status(200).json({ status: "ok", scenario: scenarioName, message: "Scenario executed" });
    }
    catch (error) {
        next(error);
    }
});
exports.default = configRouter;
