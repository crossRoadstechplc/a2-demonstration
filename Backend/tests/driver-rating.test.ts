import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Driver rating and telemetry", () => {
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

  async function createDriver(): Promise<number> {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Selam Transport",
      ownerName: "Alemu Bekele",
      region: "Addis Ababa"
    });
    const fleetId = fleetResponse.body.fleet.id as number;

    const driverResponse = await request(app).post("/drivers").send({
      name: "Abel Tesfaye",
      phone: "+251911111111",
      fleetId,
      rating: 4,
      status: "AVAILABLE"
    });

    return driverResponse.body.driver.id as number;
  }

  it("rating stored", async () => {
    const driverId = await createDriver();
    const response = await request(app).post(`/drivers/${driverId}/rate`).send({
      customerRating: 5,
      deliveryFeedback: "positive"
    });

    expect(response.status).toBe(200);
    expect(response.body.driver.customerRating).toBe(5);
    expect(response.body.driver.completedTrips).toBe(1);
    expect(response.body.driver.tripEfficiency).toBe(82);
  });

  it("safety score updated", async () => {
    const driverId = await createDriver();
    const response = await request(app).post(`/drivers/${driverId}/telemetry`).send({
      speed: 120,
      brakeForce: 0.95,
      timestamp: new Date().toISOString()
    });

    expect(response.status).toBe(200);
    expect(response.body.driver.safetyScore).toBe(92);
  });

  it("speed violation counted", async () => {
    const driverId = await createDriver();
    const response = await request(app).post(`/drivers/${driverId}/telemetry`).send({
      speed: 130,
      brakeForce: 0.2,
      timestamp: new Date().toISOString()
    });

    expect(response.status).toBe(200);
    expect(response.body.driver.speedViolations).toBe(1);
  });
});
