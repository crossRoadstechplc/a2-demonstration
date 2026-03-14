import { Router } from "express";

import { allQuery, getQuery, runQuery } from "../../database/connection";
import { requireAuth } from "../../middleware/requireAuth";
import { requireAnyRole } from "../../middleware/requireAnyRole";
import { getOrganizationIdAsNumber, isAdminOrA2OrFleetOwner } from "../../utils/accessControl";

interface Shipment {
  id: number;
  pickupLocation: string;
  deliveryLocation: string;
  cargoDescription: string;
  weight: number;
  volume: number;
  pickupWindow: string;
  requiresRefrigeration: number;
  temperatureTarget: number | null;
  customerId: number | null;
  truckId: number | null;
  driverId: number | null;
  approvedLoad: number;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickupConfirmedAt: string | null;
  deliveryConfirmedAt: string | null;
  status: "REQUESTED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
}

interface CandidateTruck {
  id: number;
  fleetId: number;
  currentSoc: number;
  status: string;
  region: string;
  truckType: string;
  availability: string;
}

interface CandidateDriver {
  id: number;
  fleetId: number;
  status: string;
}

function locationScore(pickupLocation: string, region: string): number {
  const pickup = pickupLocation.trim().toLowerCase();
  const fleetRegion = region.trim().toLowerCase();
  if (pickup === fleetRegion) {
    return 0;
  }
  if (pickup.includes(fleetRegion) || fleetRegion.includes(pickup)) {
    return 1;
  }
  return 2;
}

const freightRouter = Router();

async function addShipmentEvent(
  shipmentId: number,
  eventType: string,
  message: string
): Promise<void> {
  await runQuery(
    `
    INSERT INTO shipment_events (shipmentId, eventType, message, timestamp)
    VALUES (?, ?, ?, ?);
  `,
    [shipmentId, eventType, message, new Date().toISOString()]
  );
}

freightRouter.post("/freight/request", async (req, res, next) => {
  try {
    const {
      pickupLocation,
      deliveryLocation,
      cargoDescription,
      weight,
      volume,
      pickupWindow,
      requiresRefrigeration,
      temperatureTarget
    } = req.body as {
      pickupLocation?: string;
      deliveryLocation?: string;
      cargoDescription?: string;
      weight?: number;
      volume?: number;
      pickupWindow?: string;
      requiresRefrigeration?: boolean;
      temperatureTarget?: number;
    };

    if (
      !pickupLocation ||
      !deliveryLocation ||
      !cargoDescription ||
      weight === undefined ||
      volume === undefined ||
      !pickupWindow
    ) {
      res.status(400).json({
        error:
          "pickupLocation, deliveryLocation, cargoDescription, weight, volume and pickupWindow are required"
      });
      return;
    }

    const result = await runQuery(
      `
      INSERT INTO shipments
      (pickupLocation, deliveryLocation, cargoDescription, weight, volume, pickupWindow, requiresRefrigeration, temperatureTarget, customerId, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED');
    `,
      [
        pickupLocation,
        deliveryLocation,
        cargoDescription,
        weight,
        volume,
        pickupWindow,
        requiresRefrigeration ? 1 : 0,
        temperatureTarget ?? null,
        req.user?.role === "FREIGHT_CUSTOMER" ? req.user.id : null
      ]
    );

    await addShipmentEvent(result.lastID, "REQUESTED", "Shipment request created");
    const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
      result.lastID
    ]);
    res.status(201).json({ shipment });
  } catch (error) {
    next(error);
  }
});

freightRouter.get("/freight", async (_req, res, next) => {
  try {
    const shipments = await allQuery<Shipment>("SELECT * FROM shipments ORDER BY id DESC;");
    res.status(200).json({ shipments });
  } catch (error) {
    next(error);
  }
});

freightRouter.post("/freight/:id/assign", async (req, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    if (Number.isNaN(shipmentId)) {
      res.status(400).json({ error: "Invalid shipment id" });
      return;
    }

    const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
      shipmentId
    ]);
    if (!shipment) {
      res.status(404).json({ error: "Shipment not found" });
      return;
    }

    const candidateTrucks = await allQuery<CandidateTruck>(
      `
      SELECT t.id, t.fleetId, t.currentSoc, t.status, f.region, t.truckType, t.availability
      FROM trucks t
      INNER JOIN fleets f ON f.id = t.fleetId
      WHERE t.status = 'READY' AND t.availability = 'AVAILABLE';
    `
    );
    if (candidateTrucks.length === 0) {
      res.status(400).json({ error: "No available truck found" });
      return;
    }

    const eligibleTrucks = shipment.requiresRefrigeration
      ? candidateTrucks.filter((truck) => truck.truckType === "REFRIGERATED")
      : candidateTrucks;
    if (eligibleTrucks.length === 0) {
      res.status(400).json({ error: "No eligible truck available for shipment requirements" });
      return;
    }

    const selectedTruck = eligibleTrucks
      .slice()
      .sort((a, b) => {
        const scoreA = locationScore(shipment.pickupLocation, a.region);
        const scoreB = locationScore(shipment.pickupLocation, b.region);
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
        return b.currentSoc - a.currentSoc;
      })[0];

    const selectedDriver = await getQuery<CandidateDriver>(
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
      res.status(400).json({ error: "No available driver for selected truck fleet" });
      return;
    }

    await runQuery(
      `
      UPDATE shipments
      SET truckId = ?, driverId = ?, status = 'ASSIGNED', assignedAt = ?
      WHERE id = ?;
    `,
      [selectedTruck.id, selectedDriver.id, new Date().toISOString(), shipmentId]
    );

    await runQuery("UPDATE trucks SET status = 'IN_TRANSIT', assignedDriverId = ? WHERE id = ?;", [
      selectedDriver.id,
      selectedTruck.id
    ]);
    await runQuery("UPDATE drivers SET status = 'ON_DUTY' WHERE id = ?;", [selectedDriver.id]);
    await addShipmentEvent(
      shipmentId,
      "ASSIGNED",
      `Assigned truck ${selectedTruck.id} and driver ${selectedDriver.id}`
    );

    const updatedShipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
      shipmentId
    ]);
    res.status(200).json({ shipment: updatedShipment });
  } catch (error) {
    next(error);
  }
});

freightRouter.post(
  "/freight/:id/accept",
  requireAuth,
  requireAnyRole(["DRIVER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) {
        res.status(400).json({ error: "Invalid shipment id" });
        return;
      }

      const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      if (req.user?.role === "DRIVER") {
        const driverId = getOrganizationIdAsNumber(req);
        if (!driverId || driverId !== shipment.driverId) {
          res.status(403).json({ error: "Forbidden for driver ownership" });
          return;
        }
      }

      await runQuery(
        "UPDATE shipments SET status = 'IN_TRANSIT', acceptedAt = ? WHERE id = ?;",
        [new Date().toISOString(), shipmentId]
      );
      await addShipmentEvent(shipmentId, "ACCEPTED", "Shipment accepted by driver");
      const updated = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      res.status(200).json({ shipment: updated });
    } catch (error) {
      next(error);
    }
  }
);

freightRouter.post(
  "/freight/:id/pickup-confirm",
  requireAuth,
  requireAnyRole(["DRIVER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) {
        res.status(400).json({ error: "Invalid shipment id" });
        return;
      }

      const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      if (req.user?.role === "DRIVER") {
        const driverId = getOrganizationIdAsNumber(req);
        if (!driverId || driverId !== shipment.driverId) {
          res.status(403).json({ error: "Forbidden for driver ownership" });
          return;
        }
      }

      await runQuery("UPDATE shipments SET pickupConfirmedAt = ? WHERE id = ?;", [
        new Date().toISOString(),
        shipmentId
      ]);
      await addShipmentEvent(shipmentId, "PICKUP_CONFIRMED", "Pickup confirmed");
      const updated = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      res.status(200).json({ shipment: updated });
    } catch (error) {
      next(error);
    }
  }
);

freightRouter.post(
  "/freight/:id/delivery-confirm",
  requireAuth,
  requireAnyRole(["DRIVER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) {
        res.status(400).json({ error: "Invalid shipment id" });
        return;
      }

      const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      if (req.user?.role === "DRIVER") {
        const driverId = getOrganizationIdAsNumber(req);
        if (!driverId || driverId !== shipment.driverId) {
          res.status(403).json({ error: "Forbidden for driver ownership" });
          return;
        }
      }

      await runQuery(
        "UPDATE shipments SET status = 'DELIVERED', deliveryConfirmedAt = ? WHERE id = ?;",
        [new Date().toISOString(), shipmentId]
      );
      await addShipmentEvent(shipmentId, "DELIVERY_CONFIRMED", "Delivery confirmed");
      const updated = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      res.status(200).json({ shipment: updated });
    } catch (error) {
      next(error);
    }
  }
);

freightRouter.post(
  "/freight/:id/approve-load",
  requireAuth,
  requireAnyRole(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) {
        res.status(400).json({ error: "Invalid shipment id" });
        return;
      }

      const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      if (req.user?.role === "FLEET_OWNER") {
        const fleetId = getOrganizationIdAsNumber(req);
        const truck = await getQuery<{ fleetId: number }>("SELECT fleetId FROM trucks WHERE id = ?;", [
          shipment.truckId ?? -1
        ]);
        if (!fleetId || !truck || truck.fleetId !== fleetId) {
          res.status(403).json({ error: "Forbidden for fleet ownership" });
          return;
        }
      }

      await runQuery("UPDATE shipments SET approvedLoad = 1 WHERE id = ?;", [shipmentId]);
      await addShipmentEvent(shipmentId, "LOAD_APPROVED", "Load approved for execution");
      const updated = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      res.status(200).json({ shipment: updated });
    } catch (error) {
      next(error);
    }
  }
);

freightRouter.get("/freight/:id", requireAuth, async (req, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    if (Number.isNaN(shipmentId)) {
      res.status(400).json({ error: "Invalid shipment id" });
      return;
    }

    const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [shipmentId]);
    if (!shipment) {
      res.status(404).json({ error: "Shipment not found" });
      return;
    }

    if (req.user?.role === "FREIGHT_CUSTOMER" && shipment.customerId !== req.user.id) {
      res.status(403).json({ error: "Forbidden for customer ownership" });
      return;
    }

    if (req.user?.role === "FLEET_OWNER") {
      const fleetId = getOrganizationIdAsNumber(req);
      const truck = await getQuery<{ fleetId: number }>("SELECT fleetId FROM trucks WHERE id = ?;", [
        shipment.truckId ?? -1
      ]);
      if (!fleetId || !truck || truck.fleetId !== fleetId) {
        res.status(403).json({ error: "Forbidden for fleet ownership" });
        return;
      }
    }

    if (
      ![
        "FREIGHT_CUSTOMER",
        "FLEET_OWNER",
        "A2_OPERATOR",
        "ADMIN",
        "DRIVER",
        "EEU_OPERATOR",
        "STATION_OPERATOR"
      ].includes(req.user?.role ?? "")
    ) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.status(200).json({ shipment });
  } catch (error) {
    next(error);
  }
});

freightRouter.get("/freight/:id/tracking", requireAuth, async (req, res, next) => {
  try {
    const shipmentId = Number(req.params.id);
    if (Number.isNaN(shipmentId)) {
      res.status(400).json({ error: "Invalid shipment id" });
      return;
    }

    const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [shipmentId]);
    if (!shipment) {
      res.status(404).json({ error: "Shipment not found" });
      return;
    }

    if (req.user?.role === "FREIGHT_CUSTOMER" && shipment.customerId !== req.user.id) {
      res.status(403).json({ error: "Forbidden for customer ownership" });
      return;
    }

    if (req.user?.role === "FLEET_OWNER") {
      const fleetId = getOrganizationIdAsNumber(req);
      const truck = await getQuery<{ fleetId: number }>("SELECT fleetId FROM trucks WHERE id = ?;", [
        shipment.truckId ?? -1
      ]);
      if (!fleetId || !truck || truck.fleetId !== fleetId) {
        res.status(403).json({ error: "Forbidden for fleet ownership" });
        return;
      }
    }

    const timeline = await allQuery(
      "SELECT eventType, message, timestamp FROM shipment_events WHERE shipmentId = ? ORDER BY id ASC;",
      [shipmentId]
    );
    const assignedTruck = shipment.truckId
      ? await getQuery("SELECT id, plateNumber, truckType, status FROM trucks WHERE id = ?;", [
          shipment.truckId
        ])
      : null;
    const assignedDriver = shipment.driverId
      ? await getQuery("SELECT id, name, phone, status FROM drivers WHERE id = ?;", [
          shipment.driverId
        ])
      : null;

    res.status(200).json({
      shipmentId: shipment.id,
      status: shipment.status,
      timeline,
      assignedTruck,
      assignedDriver,
      pickupConfirmedTime: shipment.pickupConfirmedAt,
      inTransitSince: shipment.acceptedAt,
      deliveryConfirmedTime: shipment.deliveryConfirmedAt
    });
  } catch (error) {
    next(error);
  }
});

freightRouter.post(
  "/freight/:id/delivery-confirmation",
  requireAuth,
  requireAnyRole(["FREIGHT_CUSTOMER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) {
        res.status(400).json({ error: "Invalid shipment id" });
        return;
      }

      const shipment = await getQuery<Shipment>("SELECT * FROM shipments WHERE id = ?;", [
        shipmentId
      ]);
      if (!shipment) {
        res.status(404).json({ error: "Shipment not found" });
        return;
      }

      if (req.user?.role === "FREIGHT_CUSTOMER" && shipment.customerId !== req.user.id) {
        res.status(403).json({ error: "Forbidden for customer ownership" });
        return;
      }

      await addShipmentEvent(shipmentId, "CUSTOMER_CONFIRMED", "Delivery confirmation by customer");
      res.status(200).json({ status: "ok", shipmentId });
    } catch (error) {
      next(error);
    }
  }
);

export default freightRouter;
