"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../../database/connection");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const requireAuth_1 = require("../../middleware/requireAuth");
const accessControl_1 = require("../../utils/accessControl");
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
billingRouter.get("/billing/summary/a2", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const rows = await (0, connection_1.allQuery)(`
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(total), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb
        FROM receipts;
      `);
        res.status(200).json(rows[0]);
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/eeu", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "EEU_OPERATOR", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const rows = await (0, connection_1.allQuery)(`
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(energyCharge), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb
        FROM receipts;
      `);
        res.status(200).json(rows[0]);
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/stations", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR", "STATION_OPERATOR"]), async (req, res, next) => {
    try {
        const operatorStationId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
        const whereClause = req.user?.role === "STATION_OPERATOR" && operatorStationId
            ? "WHERE s.stationId = ?"
            : "";
        const params = req.user?.role === "STATION_OPERATOR" && operatorStationId ? [operatorStationId] : [];
        const revenueByStation = await (0, connection_1.allQuery)(`
        SELECT
          s.stationId,
          COALESCE(SUM(r.total), 0) as totalRevenueEtb,
          COALESCE(SUM(r.energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(r.vat), 0) as totalVatEtb,
          COALESCE(SUM(r.a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(r.eeuShare), 0) as totalEeuShareEtb,
          COUNT(r.id) as totalReceipts
        FROM swap_transactions s
        INNER JOIN receipts r ON r.swapId = s.id
        ${whereClause}
        GROUP BY s.stationId
        ORDER BY s.stationId;
      `, params);
        res.status(200).json({ revenueByStation });
    }
    catch (error) {
        next(error);
    }
});
billingRouter.get("/billing/summary/fleets", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR", "FLEET_OWNER"]), async (req, res, next) => {
    try {
        const ownerFleetId = (0, accessControl_1.getOrganizationIdAsNumber)(req);
        const whereClause = req.user?.role === "FLEET_OWNER" && ownerFleetId ? "WHERE t.fleetId = ?" : "";
        const params = req.user?.role === "FLEET_OWNER" && ownerFleetId ? [ownerFleetId] : [];
        const revenueByFleet = await (0, connection_1.allQuery)(`
        SELECT
          t.fleetId,
          COALESCE(SUM(r.total), 0) as totalRevenueEtb,
          COALESCE(SUM(r.energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(r.vat), 0) as totalVatEtb,
          COALESCE(SUM(r.a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(r.eeuShare), 0) as totalEeuShareEtb,
          COUNT(r.id) as totalReceipts
        FROM swap_transactions s
        INNER JOIN receipts r ON r.swapId = s.id
        INNER JOIN trucks t ON t.id = s.truckId
        ${whereClause}
        GROUP BY t.fleetId
        ORDER BY t.fleetId;
      `, params);
        res.status(200).json({ revenueByFleet });
    }
    catch (error) {
        next(error);
    }
});
exports.default = billingRouter;
