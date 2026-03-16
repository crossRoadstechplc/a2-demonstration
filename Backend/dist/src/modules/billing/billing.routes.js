"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../database/connection");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const requireAuth_1 = require("../../middleware/requireAuth");
const accessControl_1 = require("../../utils/accessControl");
const PAYMENT_METHODS = ["CBE", "CBEbirr", "Telebirr", "Others"];
const billingRouter = (0, express_1.Router)();
billingRouter.get("/billing/receipts", async (_req, res, next) => {
    try {
        const receipts = await (0, connection_1.allQuery)("SELECT * FROM receipts ORDER BY id DESC;");
        res.status(200).json({ receipts });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.patch("/billing/receipts/:id/pay", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR", "DRIVER", "FLEET_OWNER"]), async (req, res, next) => {
    try {
        const receiptId = Number(req.params.id);
        const { paymentMethod } = req.body;
        const method = typeof paymentMethod === "string" && PAYMENT_METHODS.includes(paymentMethod)
            ? paymentMethod
            : "CBE";
        if (!Number.isFinite(receiptId) || receiptId < 1) {
            res.status(400).json({ error: "Invalid receipt id" });
            return;
        }
        await (0, connection_1.runQuery)("UPDATE receipts SET status = 'PAID', paymentMethod = ? WHERE id = ? AND (status IS NULL OR status = 'PENDING');", [method, receiptId]);
        const updated = await (0, connection_1.allQuery)("SELECT * FROM receipts WHERE id = ?;", [receiptId]);
        res.status(200).json({ receipt: updated[0] ?? null });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/a2", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || "daily";
        let dateFilter = "";
        if (timeframe === "daily") {
            dateFilter = "WHERE date(timestamp, 'localtime') = date('now', 'localtime')";
        }
        else if (timeframe === "monthly") {
            dateFilter = "WHERE strftime('%Y-%m', timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
        }
        else if (timeframe === "yearly") {
            dateFilter = "WHERE strftime('%Y', timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')";
        }
        const rows = await (0, connection_1.allQuery)(`
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(total), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb,
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(energyKwh), 0) / COUNT(*)
            ELSE 0
          END as averageEnergyPerTransaction
        FROM receipts
        ${dateFilter};
      `);
        const result = rows[0];
        res.status(200).json({
            ...result,
            averageEnergyPerTransaction: Number((result.averageEnergyPerTransaction ?? 0).toFixed(2)),
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/eeu", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "EEU_OPERATOR", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || "daily";
        let dateFilter = "";
        if (timeframe === "daily") {
            dateFilter = "WHERE date(timestamp, 'localtime') = date('now', 'localtime')";
        }
        else if (timeframe === "monthly") {
            dateFilter = "WHERE date(timestamp, 'localtime') >= date('now', 'start of month', 'localtime')";
        }
        else if (timeframe === "yearly") {
            dateFilter = "WHERE date(timestamp, 'localtime') >= date('now', 'start of year', 'localtime')";
        }
        const rows = await (0, connection_1.allQuery)(`
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(energyCharge), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb,
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(energyKwh), 0) / COUNT(*)
            ELSE 0
          END as averageEnergyPerTransaction
        FROM receipts
        ${dateFilter};
      `);
        const result = rows[0];
        res.status(200).json({
            ...result,
            averageEnergyPerTransaction: Number((result.averageEnergyPerTransaction ?? 0).toFixed(2)),
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/stations", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR", "STATION_OPERATOR"]), async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || "daily";
        const operatorStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
        let dateFilter = "";
        if (timeframe === "daily") {
            dateFilter = "AND date(r.timestamp, 'localtime') = date('now', 'localtime')";
        }
        else if (timeframe === "monthly") {
            dateFilter = "AND strftime('%Y-%m', r.timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
        }
        else if (timeframe === "yearly") {
            dateFilter = "AND strftime('%Y', r.timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')";
        }
        const whereClause = req.user?.role === "STATION_OPERATOR" && operatorStationId
            ? "WHERE s.stationId = ?"
            : "";
        const params = req.user?.role === "STATION_OPERATOR" && operatorStationId ? [operatorStationId] : [];
        // Build WHERE clause with date filter
        let finalWhereClause = "";
        if (whereClause) {
            finalWhereClause = `${whereClause} ${dateFilter}`;
        }
        else {
            finalWhereClause = `WHERE 1=1 ${dateFilter}`;
        }
        const revenueByStation = await (0, connection_1.allQuery)(`
        SELECT
          s.stationId,
          COALESCE(SUM(r.total), 0) as totalRevenueEtb,
          COALESCE(SUM(r.energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(r.vat), 0) as totalVatEtb,
          COALESCE(SUM(r.a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(r.eeuShare), 0) as totalEeuShareEtb,
          COUNT(r.id) as totalReceipts,
          CASE 
            WHEN COUNT(r.id) > 0 THEN COALESCE(SUM(r.energyKwh), 0) / COUNT(r.id)
            ELSE 0
          END as averageEnergyPerTransaction
        FROM swap_transactions s
        INNER JOIN receipts r ON r.swapId = s.id
        ${finalWhereClause}
        GROUP BY s.stationId
        ORDER BY s.stationId;
      `, params);
        res.status(200).json({
            revenueByStation: revenueByStation.map(station => ({
                ...station,
                averageEnergyPerTransaction: Number((station.averageEnergyPerTransaction ?? 0).toFixed(2)),
            })),
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/fleets", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR", "FLEET_OWNER"]), async (req, res, next) => {
    try {
        const timeframe = req.query.timeframe || "daily";
        const ownerFleetId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
        let dateFilter = "";
        if (timeframe === "daily") {
            dateFilter = "AND date(r.timestamp, 'localtime') = date('now', 'localtime')";
        }
        else if (timeframe === "monthly") {
            dateFilter = "AND strftime('%Y-%m', r.timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
        }
        else if (timeframe === "yearly") {
            dateFilter = "AND strftime('%Y', r.timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')";
        }
        const whereClause = req.user?.role === "FLEET_OWNER" && ownerFleetId ? "WHERE t.fleetId = ?" : "";
        const params = req.user?.role === "FLEET_OWNER" && ownerFleetId ? [ownerFleetId] : [];
        // Build WHERE clause with date filter
        let finalWhereClause = "";
        if (whereClause) {
            finalWhereClause = `${whereClause} ${dateFilter}`;
        }
        else {
            finalWhereClause = `WHERE 1=1 ${dateFilter}`;
        }
        // Calculate fleet energy costs from receipts
        // Note: energyCostEtb = total (fleet pays the full receipt total)
        const revenueByFleet = await (0, connection_1.allQuery)(`
        SELECT
          t.fleetId,
          COALESCE(SUM(r.total), 0) as totalRevenueEtb,
          COALESCE(SUM(r.total), 0) as energyCostEtb,
          COALESCE(SUM(r.energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(r.vat), 0) as totalVatEtb,
          COALESCE(SUM(r.a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(r.eeuShare), 0) as totalEeuShareEtb,
          COUNT(r.id) as totalReceipts,
          CASE 
            WHEN COUNT(r.id) > 0 THEN COALESCE(SUM(r.energyKwh), 0) / COUNT(r.id)
            ELSE 0
          END as averageEnergyPerTransaction
        FROM swap_transactions s
        INNER JOIN receipts r ON r.swapId = s.id
        INNER JOIN trucks t ON t.id = s.truckId
        ${finalWhereClause}
        GROUP BY t.fleetId
        ORDER BY t.fleetId;
      `, params);
        res.status(200).json({
            revenueByFleet: revenueByFleet.map(fleet => ({
                ...fleet,
                averageEnergyPerTransaction: Number((fleet.averageEnergyPerTransaction ?? 0).toFixed(2)),
            })),
            fleets: revenueByFleet,
            timeframe,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = billingRouter;
