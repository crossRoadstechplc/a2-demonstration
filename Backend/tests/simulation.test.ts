import request from "supertest";

import app from "../src/app";
import { getQuery, initializeDatabase, runQuery } from "../src/database/connection";
import { runSimulationCycle, stopSimulation } from "../src/services/simulationRunner";

interface TruckRow {
  id: number;
  status: string;
  currentStationId: number | null;
}

interface BatteryRow {
  id: number;
  soc: number;
}

interface CountRow {
  count: number;
}

describe("Simulation engine", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterEach(() => {
    stopSimulation();
  });

  beforeEach(async () => {
    stopSimulation();
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

  async function createBaseData(): Promise<{
    stationOneId: number;
    stationTwoId: number;
    fleetId: number;
  }> {
    const stationOne = await request(app).post("/stations").send({
      name: "Modjo",
      location: "Modjo",
      capacity: 20,
      status: "ACTIVE"
    });
    const stationTwo = await request(app).post("/stations").send({
      name: "Adama",
      location: "Adama",
      capacity: 24,
      status: "ACTIVE"
    });

    const fleet = await request(app).post("/fleets").send({
      name: "Selam Transport",
      ownerName: "Alemu Bekele",
      region: "Oromia"
    });

    return {
      stationOneId: stationOne.body.station.id as number,
      stationTwoId: stationTwo.body.station.id as number,
      fleetId: fleet.body.fleet.id as number
    };
  }

  it("simulation moves trucks", async () => {
    const base = await createBaseData();
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-5001",
      fleetId: base.fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-5001",
      status: "READY",
      currentSoc: 70,
      currentStationId: base.stationOneId
    });
    const truckId = truckResponse.body.truck.id as number;

    await runSimulationCycle(new Date("2026-03-20T12:00:00.000Z"));
    await runSimulationCycle(new Date("2026-03-20T12:00:01.000Z"));

    const truck = await getQuery<TruckRow>("SELECT * FROM trucks WHERE id = ?;", [truckId]);
    expect(truck?.status).toBe("READY");
    expect(truck?.currentStationId).toBe(base.stationTwoId);
  });

  it("SOC decreases", async () => {
    const base = await createBaseData();
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-5002",
      fleetId: base.fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-5002",
      status: "IN_TRANSIT",
      currentSoc: 80,
      currentStationId: base.stationOneId
    });
    const truckId = truckResponse.body.truck.id as number;

    const batteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 80,
      health: 96,
      cycleCount: 100,
      temperature: 28,
      status: "IN_TRUCK",
      truckId
    });
    const batteryId = batteryResponse.body.battery.id as number;

    await runSimulationCycle(new Date("2026-03-20T12:00:00.000Z"));

    const battery = await getQuery<BatteryRow>("SELECT * FROM batteries WHERE id = ?;", [
      batteryId
    ]);
    expect(battery?.soc).toBe(70);
  });

  it("swap events generated", async () => {
    const base = await createBaseData();
    const truckResponse = await request(app).post("/trucks").send({
      plateNumber: "ET-5003",
      fleetId: base.fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-5003",
      status: "IN_TRANSIT",
      currentSoc: 25,
      currentStationId: base.stationOneId
    });
    const truckId = truckResponse.body.truck.id as number;

    await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 25,
      health: 94,
      cycleCount: 210,
      temperature: 30,
      status: "IN_TRUCK",
      truckId
    });

    await request(app).post("/batteries").send({
      capacityKwh: 300,
      soc: 95,
      health: 98,
      cycleCount: 40,
      temperature: 26,
      status: "READY",
      stationId: base.stationTwoId
    });

    await runSimulationCycle(new Date("2026-03-20T12:00:00.000Z"));

    const swaps = await getQuery<CountRow>("SELECT COUNT(*) as count FROM swap_transactions;");
    expect(swaps?.count).toBe(1);
  });
});
