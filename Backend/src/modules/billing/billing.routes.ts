import { Router } from "express";

import { allQuery } from "../../database/connection";
import { requireAnyRole } from "../../middleware/requireAnyRole";
import { requireAuth } from "../../middleware/requireAuth";
import { getOrganizationIdAsNumber } from "../../utils/accessControl";

interface Receipt {
  id: number;
  swapId: number;
  energyKwh: number;
  energyCharge: number;
  serviceCharge: number;
  vat: number;
  total: number;
  eeuShare: number;
  a2Share: number;
  timestamp: string;
}

const billingRouter = Router();

billingRouter.get("/billing/receipts", async (_req, res, next) => {
  try {
    const receipts = await allQuery<Receipt>("SELECT * FROM receipts ORDER BY id DESC;");
    res.status(200).json({ receipts });
  } catch (error) {
    next(error);
  }
});

billingRouter.get(
  "/billing/summary/a2",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR"]),
  async (_req, res, next) => {
    try {
      const rows = await allQuery<{
        totalReceipts: number;
        totalEnergyKwh: number;
        totalRevenueEtb: number;
        totalVatEtb: number;
        totalA2ShareEtb: number;
        totalEeuShareEtb: number;
      }>(
        `
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(total), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(a2Share), 0) as totalA2ShareEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb
        FROM receipts;
      `
      );
      res.status(200).json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

billingRouter.get(
  "/billing/summary/eeu",
  requireAuth,
  requireAnyRole(["ADMIN", "EEU_OPERATOR", "A2_OPERATOR"]),
  async (_req, res, next) => {
    try {
      const rows = await allQuery<{
        totalReceipts: number;
        totalEnergyKwh: number;
        totalRevenueEtb: number;
        totalVatEtb: number;
        totalEeuShareEtb: number;
      }>(
        `
        SELECT
          COUNT(*) as totalReceipts,
          COALESCE(SUM(energyKwh), 0) as totalEnergyKwh,
          COALESCE(SUM(energyCharge), 0) as totalRevenueEtb,
          COALESCE(SUM(vat), 0) as totalVatEtb,
          COALESCE(SUM(eeuShare), 0) as totalEeuShareEtb
        FROM receipts;
      `
      );
      res.status(200).json(rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

billingRouter.get(
  "/billing/summary/stations",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR", "STATION_OPERATOR"]),
  async (req, res, next) => {
    try {
      const operatorStationId = getOrganizationIdAsNumber(req);
      const whereClause =
        req.user?.role === "STATION_OPERATOR" && operatorStationId
          ? "WHERE s.stationId = ?"
          : "";
      const params =
        req.user?.role === "STATION_OPERATOR" && operatorStationId ? [operatorStationId] : [];

      const revenueByStation = await allQuery(
        `
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
      `,
        params
      );
      res.status(200).json({ revenueByStation });
    } catch (error) {
      next(error);
    }
  }
);

billingRouter.get(
  "/billing/summary/fleets",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR", "FLEET_OWNER"]),
  async (req, res, next) => {
    try {
      const ownerFleetId = getOrganizationIdAsNumber(req);
      const whereClause =
        req.user?.role === "FLEET_OWNER" && ownerFleetId ? "WHERE t.fleetId = ?" : "";
      const params = req.user?.role === "FLEET_OWNER" && ownerFleetId ? [ownerFleetId] : [];

      const revenueByFleet = await allQuery(
        `
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
      `,
        params
      );
      res.status(200).json({ revenueByFleet });
    } catch (error) {
      next(error);
    }
  }
);

export default billingRouter;
