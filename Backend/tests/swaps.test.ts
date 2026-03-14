import request from "supertest";

import app from "../src/app";
import { getQuery, initializeDatabase, runQuery } from "../src/database/connection";

interface BatteryRow {
  id: number;
  stationId: number | null;
  truckId: number | null;
  soc: number;
  status: string;
}

describe("Swap transactions", () => {
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

  async function createSwapSetup(): Promise<{
    truckId: number;
    stationId: number;
    incomingBatteryId: number;
    outgoingBatteryId: number;
  }> {
    const stationRes = await request(app).post("/stations").send({
      name: "Modjo",
      location: "Modjo",
      capacity: 20,
      status: "ACTIVE"
    });
    const stationId = stationRes.body.station.id as number;

    const fleetRes = await request(app).post("/fleets").send({
      name: "Abay Logistics",
      ownerName: "Dawit Mulugeta",
      region: "Amhara"
    });
    const fleetId = fleetRes.body.fleet.id as number;

    const truckRes = await request(app).post("/trucks").send({
      plateNumber: "ET-7001",
      fleetId,
      truckType: "STANDARD",
      batteryId: "1",
      status: "READY",
      currentSoc: 25
    });
    const truckId = truckRes.body.truck.id as number;

    const outgoingBatteryRes = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 25,
      health: 95,
      cycleCount: 220,
      temperature: 32,
      status: "IN_TRUCK",
      truckId
    });
    const outgoingBatteryId = outgoingBatteryRes.body.battery.id as number;

    const incomingBatteryRes = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 95,
      health: 98,
      cycleCount: 40,
      temperature: 27,
      status: "READY",
      stationId
    });
    const incomingBatteryId = incomingBatteryRes.body.battery.id as number;

    return { truckId, stationId, incomingBatteryId, outgoingBatteryId };
  }

  it("swap transaction recorded", async () => {
    const setup = await createSwapSetup();
    const response = await request(app).post("/swaps").send({
      truckId: setup.truckId,
      stationId: setup.stationId,
      incomingBatteryId: setup.incomingBatteryId,
      outgoingBatteryId: setup.outgoingBatteryId,
      arrivalSoc: 22
    });

    expect(response.status).toBe(201);
    expect(response.body.swap.truckId).toBe(setup.truckId);
    expect(response.body.swap.stationId).toBe(setup.stationId);
    expect(response.body.swap.incomingBatteryId).toBe(setup.incomingBatteryId);
    expect(response.body.swap.outgoingBatteryId).toBe(setup.outgoingBatteryId);
  });

  it("battery assignments updated", async () => {
    const setup = await createSwapSetup();
    await request(app).post("/swaps").send({
      truckId: setup.truckId,
      stationId: setup.stationId,
      incomingBatteryId: setup.incomingBatteryId,
      outgoingBatteryId: setup.outgoingBatteryId,
      arrivalSoc: 20
    });

    const incoming = await getQuery<BatteryRow>("SELECT * FROM batteries WHERE id = ?;", [
      setup.incomingBatteryId
    ]);
    const outgoing = await getQuery<BatteryRow>("SELECT * FROM batteries WHERE id = ?;", [
      setup.outgoingBatteryId
    ]);

    expect(incoming?.truckId).toBe(setup.truckId);
    expect(incoming?.stationId).toBeNull();
    expect(incoming?.status).toBe("IN_TRUCK");

    expect(outgoing?.stationId).toBe(setup.stationId);
    expect(outgoing?.truckId).toBeNull();
    expect(outgoing?.status).toBe("CHARGING");
    expect(outgoing?.soc).toBe(20);
  });

  it("energy calculated correctly", async () => {
    const setup = await createSwapSetup();
    const response = await request(app).post("/swaps").send({
      truckId: setup.truckId,
      stationId: setup.stationId,
      incomingBatteryId: setup.incomingBatteryId,
      outgoingBatteryId: setup.outgoingBatteryId,
      arrivalSoc: 20
    });

    expect(response.status).toBe(201);
    expect(response.body.swap.energyDeliveredKwh).toBe(225);
  });
});
