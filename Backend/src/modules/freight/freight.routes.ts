import { Router } from "express";

import { allQuery, getQuery, runQuery } from "../../database/connection";
import { requireAuth } from "../../middleware/requireAuth";
import { requireAnyRole } from "../../middleware/requireAnyRole";
import { getOrganizationIdAsNumber, isAdminOrA2OrFleetOwner } from "../../utils/accessControl";

interface Shipment {
  id: number;
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLocation: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
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
  locationLat: number | null;
  locationLng: number | null;
}

interface CandidateDriver {
  id: number;
  fleetId: number;
  status: string;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
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

function locationScore(
  pickupLocation: string,
  region: string,
  pickupLat: number | null,
  pickupLng: number | null,
  truckLat: number | null,
  truckLng: number | null
): number {
  // If coordinates are available, use distance-based scoring
  if (pickupLat !== null && pickupLng !== null && truckLat !== null && truckLng !== null) {
    const distance = haversineDistance(pickupLat, pickupLng, truckLat, truckLng);
    return distance; // Lower is better
  }
  // Fallback to text-based matching
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

async function assignTruckAndDriverToShipment(
  shipment: {
    pickupLocation: string;
    pickupLat: number | null;
    pickupLng: number | null;
    requiresRefrigeration: number;
  }
): Promise<{ truckId: number; driverId: number } | null> {
  const candidateTrucks = await allQuery<CandidateTruck>(
    `
      SELECT t.id, t.fleetId, t.currentSoc, t.status, f.region, t.truckType, t.availability, t.locationLat, t.locationLng
      FROM trucks t
      INNER JOIN fleets f ON f.id = t.fleetId
      WHERE t.status = 'READY' AND t.availability = 'AVAILABLE';
    `
  );
  if (candidateTrucks.length === 0) {
    return null;
  }

  const eligibleTrucks = shipment.requiresRefrigeration
    ? candidateTrucks.filter((truck) => truck.truckType === "REFRIGERATED")
    : candidateTrucks;
  if (eligibleTrucks.length === 0) {
    return null;
  }

  const selectedTruck = eligibleTrucks
    .slice()
    .sort((a, b) => {
      const scoreA = locationScore(
        shipment.pickupLocation,
        a.region,
        shipment.pickupLat,
        shipment.pickupLng,
        a.locationLat,
        a.locationLng
      );
      const scoreB = locationScore(
        shipment.pickupLocation,
        b.region,
        shipment.pickupLat,
        shipment.pickupLng,
        b.locationLat,
        b.locationLng
      );
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreA - scoreB; // Prefer closer truck
      }
      return b.currentSoc - a.currentSoc; // Then prefer higher SOC
    })[0];

  // Get top 10 available drivers by rating, then randomly select one for diversity
  const candidateDrivers = await allQuery<CandidateDriver>(
    `
      SELECT id, fleetId, status
      FROM drivers
      WHERE fleetId = ? AND status = 'AVAILABLE'
      ORDER BY overallRating DESC, id ASC
      LIMIT 10;
    `,
    [selectedTruck.fleetId]
  );
  if (candidateDrivers.length === 0) {
    return null;
  }

  // Randomly select from top candidates to ensure driver diversity
  const selectedDriver = candidateDrivers[Math.floor(Math.random() * candidateDrivers.length)];

  return { truckId: selectedTruck.id, driverId: selectedDriver.id };
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
      pickupLat,
      pickupLng,
      deliveryLocation,
      deliveryLat,
      deliveryLng,
      cargoDescription,
      weight,
      volume,
      pickupWindow,
      requiresRefrigeration,
      temperatureTarget
    } = req.body as {
      pickupLocation?: string;
      pickupLat?: number;
      pickupLng?: number;
      deliveryLocation?: string;
      deliveryLat?: number;
      deliveryLng?: number;
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
      !pickupWindow ||
      pickupLat === undefined ||
      pickupLng === undefined ||
      deliveryLat === undefined ||
      deliveryLng === undefined
    ) {
      res.status(400).json({
        error:
          "pickupLocation, pickupLat, pickupLng, deliveryLocation, deliveryLat, deliveryLng, cargoDescription, weight, volume and pickupWindow are required"
      });
      return;
    }

    // Validate coordinates are within corridor bounds
    if (
      pickupLat < 8.5 ||
      pickupLat > 12.0 ||
      pickupLng < 38.5 ||
      pickupLng > 43.5 ||
      deliveryLat < 8.5 ||
      deliveryLat > 12.0 ||
      deliveryLng < 38.5 ||
      deliveryLng > 43.5
    ) {
      res.status(400).json({
        error: "Pickup and delivery coordinates must be within the A2 corridor bounds"
      });
      return;
    }

    // Validate minimum distance
    const distance = haversineDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
    if (distance < 1) {
      res.status(400).json({
        error: "Delivery must be at least 1 km away from pickup location"
      });
      return;
    }

    // Attempt immediate assignment
    const assignment = await assignTruckAndDriverToShipment({
      pickupLocation,
      pickupLat,
      pickupLng,
      requiresRefrigeration: requiresRefrigeration ? 1 : 0,
    });

    if (!assignment) {
      res.status(409).json({
        error: "No eligible truck and driver available for immediate assignment. Please try again later."
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const result = await runQuery(
      `
      INSERT INTO shipments
      (pickupLocation, pickupLat, pickupLng, deliveryLocation, deliveryLat, deliveryLng, cargoDescription, weight, volume, pickupWindow, requiresRefrigeration, temperatureTarget, customerId, truckId, driverId, status, assignedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?);
    `,
      [
        pickupLocation,
        pickupLat,
        pickupLng,
        deliveryLocation,
        deliveryLat,
        deliveryLng,
        cargoDescription,
        weight,
        volume,
        pickupWindow,
        requiresRefrigeration ? 1 : 0,
        temperatureTarget ?? null,
        req.user?.role === "FREIGHT_CUSTOMER" ? req.user.id : null,
        assignment.truckId,
        assignment.driverId,
        timestamp
      ]
    );

    // Update truck and driver status
    await runQuery("UPDATE trucks SET status = 'IN_TRANSIT', assignedDriverId = ? WHERE id = ?;", [
      assignment.driverId,
      assignment.truckId
    ]);
    await runQuery("UPDATE drivers SET status = 'ON_DUTY' WHERE id = ?;", [assignment.driverId]);

    await addShipmentEvent(result.lastID, "REQUESTED", "Shipment request created");
    await addShipmentEvent(
      result.lastID,
      "ASSIGNED",
      `Assigned truck ${assignment.truckId} and driver ${assignment.driverId}`
    );

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
      SELECT t.id, t.fleetId, t.currentSoc, t.status, f.region, t.truckType, t.availability, t.locationLat, t.locationLng
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

    const shipmentData = await getQuery<{
      pickupLocation: string;
      pickupLat: number | null;
      pickupLng: number | null;
      requiresRefrigeration: number;
    }>("SELECT pickupLocation, pickupLat, pickupLng, requiresRefrigeration FROM shipments WHERE id = ?;", [
      shipmentId
    ]);

    const selectedTruck = eligibleTrucks
      .slice()
      .sort((a, b) => {
        const scoreA = locationScore(
          shipmentData?.pickupLocation ?? shipment.pickupLocation,
          a.region,
          shipmentData?.pickupLat ?? null,
          shipmentData?.pickupLng ?? null,
          a.locationLat,
          a.locationLng
        );
        const scoreB = locationScore(
          shipmentData?.pickupLocation ?? shipment.pickupLocation,
          b.region,
          shipmentData?.pickupLat ?? null,
          shipmentData?.pickupLng ?? null,
          b.locationLat,
          b.locationLng
        );
        if (Math.abs(scoreA - scoreB) > 0.1) {
          return scoreA - scoreB;
        }
        return b.currentSoc - a.currentSoc;
      })[0];

    // Get top 10 available drivers by rating, then randomly select one for diversity
    const candidateDrivers = await allQuery<CandidateDriver>(
      `
      SELECT id, fleetId, status
      FROM drivers
      WHERE fleetId = ? AND status = 'AVAILABLE'
      ORDER BY overallRating DESC, id ASC
      LIMIT 10;
    `,
      [selectedTruck.fleetId]
    );
    if (candidateDrivers.length === 0) {
      res.status(400).json({ error: "No available driver for selected truck fleet" });
      return;
    }

    // Randomly select from top candidates to ensure driver diversity
    const selectedDriver = candidateDrivers[Math.floor(Math.random() * candidateDrivers.length)];

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
