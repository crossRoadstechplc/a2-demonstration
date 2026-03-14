import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Battery management", () => {
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

  it("registers battery", async () => {
    const response = await request(app).post("/batteries").send({
      capacityKwh: 250,
      soc: 84,
      health: 96,
      cycleCount: 120,
      temperature: 28.5,
      status: "READY"
    });

    expect(response.status).toBe(201);
    expect(response.body.battery.capacityKwh).toBe(250);
    expect(response.body.battery.status).toBe("READY");
  });

  it("updates SOC", async () => {
    const created = await request(app).post("/batteries").send({
      capacityKwh: 210,
      soc: 70,
      health: 94,
      cycleCount: 80,
      temperature: 27,
      status: "READY"
    });

    const batteryId = created.body.battery.id as number;
    const response = await request(app).patch(`/batteries/${batteryId}/soc`).send({
      soc: 55.5
    });

    expect(response.status).toBe(200);
    expect(response.body.battery.soc).toBe(55.5);
  });

  it("assigns battery to truck", async () => {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Selam Transport",
      ownerName: "Alemu Bekele",
      region: "Addis Ababa"
    });
    const fleetId = fleetResponse.body.fleet.id as number;

    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-9001",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-9001",
      status: "READY",
      currentSoc: 78
    });
    const truckId = truckResponse.body.truck.id as number;

    const batteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 260,
      soc: 66,
      health: 92,
      cycleCount: 140,
      temperature: 29,
      status: "READY"
    });
    const batteryId = batteryResponse.body.battery.id as number;

    const response = await request(app)
      .patch(`/batteries/${batteryId}/assign-truck`)
      .send({ truckId });

    expect(response.status).toBe(200);
    expect(response.body.battery.truckId).toBe(truckId);
    expect(response.body.battery.stationId).toBeNull();
    expect(response.body.battery.status).toBe("IN_TRUCK");
  });

  it("assigns battery to station", async () => {
    const stationResponse = await request(app).post("/stations").send({
      name: "Addis Hub",
      location: "Addis Ababa",
      capacity: 40,
      status: "ACTIVE"
    });
    const stationId = stationResponse.body.station.id as number;

    const batteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 230,
      soc: 45,
      health: 95,
      cycleCount: 110,
      temperature: 30,
      status: "READY"
    });
    const batteryId = batteryResponse.body.battery.id as number;

    const response = await request(app)
      .patch(`/batteries/${batteryId}/assign-station`)
      .send({ stationId });

    expect(response.status).toBe(200);
    expect(response.body.battery.stationId).toBe(stationId);
    expect(response.body.battery.truckId).toBeNull();
    expect(response.body.battery.status).toBe("CHARGING");
  });
});
