import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Freight bookings", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    await runQuery("DELETE FROM receipts;");
    await runQuery("DELETE FROM charging_sessions;");
    await runQuery("DELETE FROM swap_transactions;");
    await runQuery("DELETE FROM batteries;");
    await runQuery("DELETE FROM shipments;");
    await runQuery("DELETE FROM driver_telemetry;");
    await runQuery("DELETE FROM trucks;");
    await runQuery("DELETE FROM drivers;");
    await runQuery("DELETE FROM fleets;");
    await runQuery("DELETE FROM stations;");
  });

  async function createAssignableFleetData(): Promise<void> {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Abay Logistics",
      ownerName: "Dawit Mulugeta",
      region: "Adama"
    });
    const fleetId = fleetResponse.body.fleet.id as number;

    await request(app).post("/trucks").send({
      plateNumber: "ET-7701",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-7701",
      status: "READY",
      currentSoc: 88,
      availability: "AVAILABLE",
      locationLat: 8.54,
      locationLng: 39.27
    });

    await request(app).post("/drivers").send({
      name: "Dawit Mekonnen",
      phone: "+251922222222",
      fleetId,
      rating: 4.7,
      status: "AVAILABLE"
    });
  }

  it("create freight request with immediate assignment", async () => {
    await createAssignableFleetData();
    const response = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      pickupLat: 8.54,
      pickupLng: 39.27,
      deliveryLocation: "Dire Dawa",
      deliveryLat: 9.6,
      deliveryLng: 41.86,
      cargoDescription: "Cold medicines",
      weight: 3500,
      volume: 16,
      pickupWindow: "2026-03-15T08:00:00.000Z"
    });

    expect(response.status).toBe(201);
    expect(response.body.shipment.status).toBe("ASSIGNED");
    expect(response.body.shipment.truckId).toBeDefined();
    expect(response.body.shipment.driverId).toBeDefined();
    expect(response.body.shipment.pickupLat).toBe(8.54);
    expect(response.body.shipment.pickupLng).toBe(39.27);
    expect(response.body.shipment.deliveryLat).toBe(9.6);
    expect(response.body.shipment.deliveryLng).toBe(41.86);
  });

  it("create freight request fails when no truck available", async () => {
    const response = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      pickupLat: 8.54,
      pickupLng: 39.27,
      deliveryLocation: "Dire Dawa",
      deliveryLat: 9.6,
      deliveryLng: 41.86,
      cargoDescription: "Cold medicines",
      weight: 3500,
      volume: 16,
      pickupWindow: "2026-03-15T08:00:00.000Z"
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("No eligible truck");
  });

  it("assign truck via separate endpoint (for existing shipments)", async () => {
    await createAssignableFleetData();
    // Create a shipment manually without assignment (for testing the assign endpoint)
    const insertResult = await runQuery(
      `INSERT INTO shipments (pickupLocation, pickupLat, pickupLng, deliveryLocation, deliveryLat, deliveryLng, cargoDescription, weight, volume, pickupWindow, requiresRefrigeration, customerId, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REQUESTED');`,
      ["Adama", 8.54, 39.27, "Awash", 8.98, 40.17, "Packaged food", 4200, 20, "2026-03-15T10:00:00.000Z", 0, 1]
    );
    const shipmentId = insertResult.lastID;

    const assignResponse = await request(app).post(`/freight/${shipmentId}/assign`).send({});

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.shipment.truckId).toBeDefined();
    expect(assignResponse.body.shipment.driverId).toBeDefined();
  });

  it("validates coordinates are required", async () => {
    await createAssignableFleetData();
    const response = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      deliveryLocation: "Modjo",
      cargoDescription: "Spare parts",
      weight: 2800,
      volume: 11,
      pickupWindow: "2026-03-16T06:00:00.000Z"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("required");
  });
});
