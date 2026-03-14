import request from "supertest";

import app from "../src/app";
import { initializeDatabase, runQuery } from "../src/database/connection";

describe("Refrigerated trucks", () => {
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

  async function createFleet(): Promise<number> {
    const fleetResponse = await request(app).post("/fleets").send({
      name: "Cold Chain Fleet",
      ownerName: "Mekonnen Taye",
      region: "Addis Ababa"
    });
    return fleetResponse.body.fleet.id as number;
  }

  it("refrigerated truck stored", async () => {
    const fleetId = await createFleet();
    const createResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-9901",
      fleetId,
      truckType: "REFRIGERATED",
      batteryId: "BAT-9901",
      status: "READY",
      currentSoc: 88,
      refrigerationPowerDraw: 12,
      temperatureTarget: 4,
      temperatureCurrent: 6
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.truck.truckType).toBe("REFRIGERATED");
    expect(createResponse.body.truck.refrigerationPowerDraw).toBe(12);

    const listResponse = await request(app).get("/trucks/refrigerated");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.trucks.length).toBe(1);
    expect(listResponse.body.trucks[0].plateNumber).toBe("ET-9901");
  });

  it("extra power consumption calculated", async () => {
    const stationResponse = await request(app).post("/stations").send({
      name: "Dire Dawa",
      location: "Dire Dawa",
      capacity: 18,
      status: "ACTIVE"
    });
    const stationId = stationResponse.body.station.id as number;

    const fleetId = await createFleet();
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-9902",
      fleetId,
      truckType: "REFRIGERATED",
      batteryId: "BAT-9902",
      status: "READY",
      currentSoc: 35,
      refrigerationPowerDraw: 12,
      temperatureTarget: 4,
      temperatureCurrent: 5
    });
    const truckId = truckResponse.body.truck.id as number;

    const outgoingBatteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 30,
      health: 95,
      cycleCount: 200,
      temperature: 32,
      status: "IN_TRUCK",
      truckId
    });
    const outgoingBatteryId = outgoingBatteryResponse.body.battery.id as number;

    const incomingBatteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 95,
      health: 98,
      cycleCount: 40,
      temperature: 27,
      status: "READY",
      stationId
    });
    const incomingBatteryId = incomingBatteryResponse.body.battery.id as number;

    const swapResponse = await request(app).post("/swaps").send({
      truckId,
      stationId,
      incomingBatteryId,
      outgoingBatteryId,
      arrivalSoc: 20
    });

    expect(swapResponse.status).toBe(201);
    expect(swapResponse.body.swap.energyDeliveredKwh).toBe(237);
  });

  it("temperature updated", async () => {
    const fleetId = await createFleet();
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-9903",
      fleetId,
      truckType: "REFRIGERATED",
      batteryId: "BAT-9903",
      status: "READY",
      currentSoc: 70,
      refrigerationPowerDraw: 10,
      temperatureTarget: 5,
      temperatureCurrent: 8
    });
    const truckId = truckResponse.body.truck.id as number;

    const patchResponse = await request(app).patch(`/trucks/${truckId}/temperature`).send({
      temperatureCurrent: 3
    });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.truck.temperatureCurrent).toBe(3);
    expect(patchResponse.body.truck.temperatureTarget).toBe(5);
  });
});
