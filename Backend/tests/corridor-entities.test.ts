import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Corridor entities", () => {
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

  it("creates station", async () => {
    const response = await request(app).post("/stations").send({
      name: "Station Alpha",
      location: "Lusaka",
      capacity: 20,
      status: "ACTIVE"
    });

    expect(response.status).toBe(201);
    expect(response.body.station.name).toBe("Station Alpha");
  });

  it("creates fleet", async () => {
    const response = await request(app).post("/fleets").send({
      name: "Fleet One",
      ownerName: "Owner One",
      region: "North"
    });

    expect(response.status).toBe(201);
    expect(response.body.fleet.name).toBe("Fleet One");
  });

  it("creates truck", async () => {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Fleet Truck",
      ownerName: "Fleet Owner",
      region: "Central"
    });

    const fleetId = fleetResponse.body.fleet.id as number;
    const response = await request(app).post("/trucks").send({
      plateNumber: "ABC-1234",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-001",
      status: "READY",
      currentSoc: 82.5
    });

    expect(response.status).toBe(201);
    expect(response.body.truck.plateNumber).toBe("ABC-1234");
    expect(response.body.truck.fleetId).toBe(fleetId);
  });

  it("creates driver", async () => {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Fleet Driver",
      ownerName: "Owner Driver",
      region: "East"
    });

    const fleetId = fleetResponse.body.fleet.id as number;
    const response = await request(app).post("/drivers").send({
      name: "Driver One",
      phone: "+260700000001",
      fleetId,
      rating: 4.8,
      status: "AVAILABLE"
    });

    expect(response.status).toBe(201);
    expect(response.body.driver.name).toBe("Driver One");
    expect(response.body.driver.fleetId).toBe(fleetId);
  });
});
