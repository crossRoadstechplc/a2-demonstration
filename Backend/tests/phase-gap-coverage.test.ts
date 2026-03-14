import request from "supertest";

import app from "../src/app";
import { getQuery, initializeDatabase, runQuery } from "../src/database/connection";

interface AuthResult {
  token: string;
  userId: number;
}

describe("Phase gap coverage", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery("DELETE FROM receipts;");
    await runQuery("DELETE FROM charging_sessions;");
    await runQuery("DELETE FROM swap_transactions;");
    await runQuery("DELETE FROM battery_events;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM shipment_events;");
    await runQuery("DELETE FROM shipments;");
    await runQuery("DELETE FROM truck_arrivals;");
    await runQuery("DELETE FROM station_incidents;");
    await runQuery("DELETE FROM charger_faults;");
    await runQuery("DELETE FROM driver_telemetry;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM drivers;");
    await runQuery("DELETE FROM fleets;");
    await runQuery("DELETE FROM stations;");
    await runQuery("DELETE FROM users;");
  });

  async function register(role: string, organizationId?: string): Promise<AuthResult> {
    const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const response = await request(app).post("/auth/register").send({
      name: `${role} User`,
      email: `${role.toLowerCase()}_${unique}@example.com`,
      password: "secret123",
      role,
      organizationId: organizationId ?? null
    });
    return { token: response.body.token as string, userId: response.body.user.id as number };
  }

  it("config endpoints enforce role and validation", async () => {
    const admin = await register("ADMIN");
    const driver = await register("DRIVER");

    const forbidden = await request(app)
      .patch("/config/tariffs")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({ eeuRatePerKwh: 12, a2ServiceRatePerKwh: 11, vatPercent: 16 });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .patch("/config/tariffs")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ eeuRatePerKwh: 12 });
    expect(invalid.status).toBe(400);

    const updated = await request(app)
      .patch("/config/tariffs")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ eeuRatePerKwh: 12, a2ServiceRatePerKwh: 13, vatPercent: 17 });
    expect(updated.status).toBe(200);
    expect(updated.body.tariffs.eeuRatePerKwh).toBe(12);
  });

  it("user role update validates and restricts admin-only", async () => {
    const admin = await register("ADMIN");
    const a2 = await register("A2_OPERATOR");
    const target = await register("DRIVER");

    const forbidden = await request(app)
      .patch(`/users/${target.userId}/role`)
      .set("Authorization", `Bearer ${a2.token}`)
      .send({ role: "ADMIN" });
    expect(forbidden.status).toBe(403);

    const invalidRole = await request(app)
      .patch(`/users/${target.userId}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "BAD_ROLE" });
    expect(invalidRole.status).toBe(400);

    const success = await request(app)
      .patch(`/users/${target.userId}/role`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ role: "FLEET_OWNER" });
    expect(success.status).toBe(200);
    expect(success.body.user.role).toBe("FLEET_OWNER");
  });

  it("station incidents and faults respect ownership", async () => {
    const stationOne = await request(app).post("/stations").send({
      name: "Adama",
      location: "Adama",
      capacity: 20,
      status: "ACTIVE"
    });
    const stationTwo = await request(app).post("/stations").send({
      name: "Awash",
      location: "Awash",
      capacity: 14,
      status: "ACTIVE"
    });
    const stationOneId = stationOne.body.station.id as number;
    const stationTwoId = stationTwo.body.station.id as number;

    const operator = await register("STATION_OPERATOR", String(stationOneId));
    const a2 = await register("A2_OPERATOR");

    const ownCreate = await request(app)
      .post(`/stations/${stationOneId}/incidents`)
      .set("Authorization", `Bearer ${operator.token}`)
      .send({ type: "QUEUE", severity: "HIGH", message: "Queue overflow", status: "OPEN" });
    expect(ownCreate.status).toBe(201);

    const forbidden = await request(app)
      .post(`/stations/${stationTwoId}/incidents`)
      .set("Authorization", `Bearer ${operator.token}`)
      .send({ type: "POWER", severity: "MEDIUM", message: "Power dip", status: "OPEN" });
    expect(forbidden.status).toBe(403);

    const fault = await request(app)
      .post(`/stations/${stationOneId}/charger-faults`)
      .set("Authorization", `Bearer ${operator.token}`)
      .send({
        chargerId: "CH-1",
        faultCode: "E-42",
        message: "Connector issue",
        status: "OPEN"
      });
    expect(fault.status).toBe(201);

    const a2View = await request(app)
      .get(`/stations/${stationOneId}/charger-faults`)
      .set("Authorization", `Bearer ${a2.token}`);
    expect(a2View.status).toBe(200);
    expect(a2View.body.chargerFaults.length).toBe(1);
  });

  it("fleet assign-driver flow and availability endpoint work with ownership restrictions", async () => {
    const fleet = await request(app).post("/fleets").send({
      name: "Fleet One",
      ownerName: "Owner One",
      region: "Adama"
    });
    const fleetId = fleet.body.fleet.id as number;

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-6001",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-6001",
      status: "READY",
      currentSoc: 82
    });
    const truckId = truck.body.truck.id as number;

    const driver = await request(app).post("/drivers").send({
      name: "Abel Tesfaye",
      phone: "+251944444444",
      fleetId,
      rating: 4.5,
      status: "AVAILABLE"
    });
    const driverId = driver.body.driver.id as number;

    const owner = await register("FLEET_OWNER", String(fleetId));
    const wrongOwner = await register("FLEET_OWNER", String(fleetId + 999));

    const forbidden = await request(app)
      .post(`/fleets/${fleetId}/assign-driver`)
      .set("Authorization", `Bearer ${wrongOwner.token}`)
      .send({ driverId, truckId });
    expect(forbidden.status).toBe(403);

    const assigned = await request(app)
      .post(`/fleets/${fleetId}/assign-driver`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ driverId, truckId });
    expect(assigned.status).toBe(200);

    const avail = await request(app)
      .patch(`/trucks/${truckId}/availability`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ availability: "UNAVAILABLE" });
    expect(avail.status).toBe(200);
    expect(avail.body.truck.availability).toBe("UNAVAILABLE");
  });

  it("driver shipment workflow progresses accept -> pickup -> delivery", async () => {
    const station = await request(app).post("/stations").send({
      name: "Modjo",
      location: "Modjo",
      capacity: 24,
      status: "ACTIVE"
    });
    const stationId = station.body.station.id as number;

    const fleet = await request(app).post("/fleets").send({
      name: "Workflow Fleet",
      ownerName: "Owner Workflow",
      region: "Modjo"
    });
    const fleetId = fleet.body.fleet.id as number;

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-6002",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-6002",
      status: "READY",
      currentSoc: 70,
      currentStationId: stationId
    });
    const truckId = truck.body.truck.id as number;

    const driver = await request(app).post("/drivers").send({
      name: "Dawit Mekonnen",
      phone: "+251955555555",
      fleetId,
      rating: 4.8,
      status: "AVAILABLE"
    });
    const driverId = driver.body.driver.id as number;

    const driverUser = await register("DRIVER", String(driverId));

    const requestRes = await request(app).post("/freight/request").send({
      pickupLocation: "Modjo",
      deliveryLocation: "Dire Dawa",
      cargoDescription: "Electronics",
      weight: 2500,
      volume: 12,
      pickupWindow: "2026-03-20T08:00:00.000Z"
    });
    const shipmentId = requestRes.body.shipment.id as number;
    await runQuery("UPDATE shipments SET truckId = ?, driverId = ?, status = 'ASSIGNED' WHERE id = ?;", [
      truckId,
      driverId,
      shipmentId
    ]);

    const accept = await request(app)
      .post(`/freight/${shipmentId}/accept`)
      .set("Authorization", `Bearer ${driverUser.token}`)
      .send({});
    expect(accept.status).toBe(200);
    expect(accept.body.shipment.status).toBe("IN_TRANSIT");

    const pickup = await request(app)
      .post(`/freight/${shipmentId}/pickup-confirm`)
      .set("Authorization", `Bearer ${driverUser.token}`)
      .send({});
    expect(pickup.status).toBe(200);
    expect(pickup.body.shipment.pickupConfirmedAt).toBeTruthy();

    const delivered = await request(app)
      .post(`/freight/${shipmentId}/delivery-confirm`)
      .set("Authorization", `Bearer ${driverUser.token}`)
      .send({});
    expect(delivered.status).toBe(200);
    expect(delivered.body.shipment.status).toBe("DELIVERED");
  });

  it("finance summaries and battery history return aggregated data", async () => {
    const admin = await register("ADMIN");
    const eeu = await register("EEU_OPERATOR");

    const station = await request(app).post("/stations").send({
      name: "Semera",
      location: "Semera",
      capacity: 20,
      status: "ACTIVE"
    });
    const stationId = station.body.station.id as number;

    const fleet = await request(app).post("/fleets").send({
      name: "Finance Fleet",
      ownerName: "Finance Owner",
      region: "Semera"
    });
    const fleetId = fleet.body.fleet.id as number;

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-6003",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-6003",
      status: "READY",
      currentSoc: 30
    });
    const truckId = truck.body.truck.id as number;

    const outgoing = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 30,
      health: 96,
      cycleCount: 140,
      temperature: 30,
      status: "IN_TRUCK",
      truckId
    });
    const outgoingId = outgoing.body.battery.id as number;

    const incoming = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 95,
      health: 98,
      cycleCount: 40,
      temperature: 25,
      status: "READY",
      stationId
    });
    const incomingId = incoming.body.battery.id as number;

    await request(app).post("/swaps").send({
      truckId,
      stationId,
      incomingBatteryId: incomingId,
      outgoingBatteryId: outgoingId,
      arrivalSoc: 20
    });

    const a2Summary = await request(app)
      .get("/billing/summary/a2")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(a2Summary.status).toBe(200);
    expect(a2Summary.body.totalReceipts).toBeGreaterThanOrEqual(1);

    const eeuSummary = await request(app)
      .get("/billing/summary/eeu")
      .set("Authorization", `Bearer ${eeu.token}`);
    expect(eeuSummary.status).toBe(200);
    expect(eeuSummary.body.totalEeuShareEtb).toBeGreaterThan(0);

    const history = await request(app).get(`/batteries/${outgoingId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.assignmentChanges.length).toBeGreaterThan(0);
    expect(history.body.swapParticipation.length).toBeGreaterThan(0);
  });

  it("freight tracking timeline and detail endpoints enforce ownership", async () => {
    const customer = await register("FREIGHT_CUSTOMER");
    const otherCustomer = await register("FREIGHT_CUSTOMER");
    const a2 = await register("A2_OPERATOR");

    const create = await request(app)
      .post("/freight/request")
      .set("Authorization", `Bearer ${customer.token}`)
      .send({
        pickupLocation: "Adama",
        deliveryLocation: "Awash",
        cargoDescription: "Cold goods",
        weight: 2000,
        volume: 10,
        pickupWindow: "2026-03-22T08:00:00.000Z",
        requiresRefrigeration: true,
        temperatureTarget: 4
      });
    const shipmentId = create.body.shipment.id as number;

    const forbidden = await request(app)
      .get(`/freight/${shipmentId}`)
      .set("Authorization", `Bearer ${otherCustomer.token}`);
    expect(forbidden.status).toBe(403);

    await request(app)
      .post(`/freight/${shipmentId}/delivery-confirmation`)
      .set("Authorization", `Bearer ${customer.token}`)
      .send({});

    const tracking = await request(app)
      .get(`/freight/${shipmentId}/tracking`)
      .set("Authorization", `Bearer ${a2.token}`);
    expect(tracking.status).toBe(200);
    expect(tracking.body.timeline.length).toBeGreaterThan(0);
  });

  it("dashboard and live feed new endpoints return data", async () => {
    const station = await request(app).post("/stations").send({
      name: "Live Station",
      location: "Mille",
      capacity: 18,
      status: "ACTIVE"
    });
    const stationId = station.body.station.id as number;

    await runQuery(
      `
      INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt)
      VALUES (?, 'QUEUE', 'HIGH', 'Live incident', 'OPEN', ?);
    `,
      [stationId, new Date().toISOString()]
    );

    const customer = await register("FREIGHT_CUSTOMER");
    const freightDash = await request(app).get(`/dashboard/freight/${customer.userId}`);
    expect(freightDash.status).toBe(200);
    expect(freightDash.body.totalShipments).toBeDefined();

    const liveFeed = await request(app).get("/dashboard/a2/live-feed");
    expect(liveFeed.status).toBe(200);
    expect(liveFeed.body.incidents.length).toBeGreaterThanOrEqual(1);
  });

  it("demo utilities are protected and executable", async () => {
    const admin = await register("ADMIN");
    const driver = await register("DRIVER");

    const unauthorized = await request(app).post("/demo/seed").send({});
    expect(unauthorized.status).toBe(401);

    const forbidden = await request(app)
      .post("/demo/reset")
      .set("Authorization", `Bearer ${driver.token}`)
      .send({});
    expect(forbidden.status).toBe(403);

    const seeded = await request(app)
      .post("/demo/seed")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(seeded.status).toBe(200);

    const scenario = await request(app)
      .post("/demo/scenario/charger-fault")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({});
    expect(scenario.status).toBe(200);
  });
});
