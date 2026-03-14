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
      currentSoc: 88
    });

    await request(app).post("/drivers").send({
      name: "Dawit Mekonnen",
      phone: "+251922222222",
      fleetId,
      rating: 4.7,
      status: "AVAILABLE"
    });
  }

  it("create freight request", async () => {
    const response = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      deliveryLocation: "Dire Dawa",
      cargoDescription: "Cold medicines",
      weight: 3500,
      volume: 16,
      pickupWindow: "2026-03-15T08:00:00.000Z"
    });

    expect(response.status).toBe(201);
    expect(response.body.shipment.status).toBe("REQUESTED");
    expect(response.body.shipment.truckId).toBeNull();
    expect(response.body.shipment.driverId).toBeNull();
  });

  it("assign truck", async () => {
    await createAssignableFleetData();
    const requestResponse = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      deliveryLocation: "Awash",
      cargoDescription: "Packaged food",
      weight: 4200,
      volume: 20,
      pickupWindow: "2026-03-15T10:00:00.000Z"
    });
    const shipmentId = requestResponse.body.shipment.id as number;

    const assignResponse = await request(app).post(`/freight/${shipmentId}/assign`).send({});

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.shipment.truckId).toBeDefined();
    expect(assignResponse.body.shipment.driverId).toBeDefined();
  });

  it("update shipment status", async () => {
    await createAssignableFleetData();
    const requestResponse = await request(app).post("/freight/request").send({
      pickupLocation: "Adama",
      deliveryLocation: "Modjo",
      cargoDescription: "Spare parts",
      weight: 2800,
      volume: 11,
      pickupWindow: "2026-03-16T06:00:00.000Z"
    });
    const shipmentId = requestResponse.body.shipment.id as number;

    const assignResponse = await request(app).post(`/freight/${shipmentId}/assign`).send({});

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.shipment.status).toBe("ASSIGNED");
  });
});
