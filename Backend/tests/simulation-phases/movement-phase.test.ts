import request from "supertest";

import app from "../../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../../src/database/connection";
import { runMovementPhase } from "../../src/services/simulation/phases/movement-phase";
import type { SimulationContext } from "../../src/services/simulation/types";

describe("Movement Phase", () => {
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

  async function createBaseData(): Promise<{
    stationOneId: number;
    stationTwoId: number;
    fleetId: number;
    driverId: number;
    truckId: number;
  }> {
    const stationOne = await request(app).post("/stations").send({
      name: "Modjo",
      location: "Modjo",
      capacity: 20,
      status: "ACTIVE",
    });
    const stationTwo = await request(app).post("/stations").send({
      name: "Adama",
      location: "Adama",
      capacity: 24,
      status: "ACTIVE",
    });

    const fleet = await request(app).post("/fleets").send({
      name: "Selam Transport",
      ownerName: "Alemu Bekele",
      region: "Oromia",
    });

    const driver = await request(app).post("/drivers").send({
      name: "Test Driver",
      phone: "+251911111111",
      fleetId: fleet.body.fleet.id,
      rating: 4.5,
      status: "AVAILABLE",
    });

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-5001",
      fleetId: fleet.body.fleet.id,
      truckType: "STANDARD",
      batteryId: "BAT-5001",
      status: "READY",
      currentSoc: 70,
      currentStationId: stationOne.body.station.id,
    });

    return {
      stationOneId: stationOne.body.station.id as number,
      stationTwoId: stationTwo.body.station.id as number,
      fleetId: fleet.body.fleet.id as number,
      driverId: driver.body.driver.id as number,
      truckId: truck.body.truck.id as number,
    };
  }

  it("updates truck location during transit", async () => {
    const base = await createBaseData();

    // Assign driver to truck
    await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
      base.truckId,
      base.driverId,
    ]);
    await runQuery("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentStationId = NULL WHERE id = ?;", [
      base.driverId,
      base.truckId,
    ]);

    // Create context
    const stations = await allQuery<{ id: number; name: string }>(
      "SELECT id, name FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const stationById = new Map(stations.map((s) => [s.id, s]));

    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById,
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };

    // Run movement phase
    await runMovementPhase(context);

    // Check truck location was updated
    const truck = await getQuery<{ locationLat: number | null; locationLng: number | null }>(
      "SELECT locationLat, locationLng FROM trucks WHERE id = ?;",
      [base.truckId]
    );

    expect(truck?.locationLat).not.toBeNull();
    expect(truck?.locationLng).not.toBeNull();
  });

  it("drains SOC during transit", async () => {
    const base = await createBaseData();

    // Create battery for truck
    await runQuery(
      "INSERT INTO batteries (capacityKwh, soc, health, cycleCount, temperature, status, truckId) VALUES (588, 80, 95, 100, 27, 'IN_TRUCK', ?);",
      [base.truckId]
    );

    // Assign driver and start transit
    await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
      base.truckId,
      base.driverId,
    ]);
    await runQuery("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentSoc = 80, currentStationId = NULL WHERE id = ?;", [
      base.driverId,
      base.truckId,
    ]);

    const stations = await allQuery<{ id: number; name: string }>(
      "SELECT id, name FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const stationById = new Map(stations.map((s) => [s.id, s]));

    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById,
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };

    // Run movement phase
    await runMovementPhase(context);

    // Check SOC was drained
    const truck = await getQuery<{ currentSoc: number }>("SELECT currentSoc FROM trucks WHERE id = ?;", [
      base.truckId,
    ]);
    const battery = await getQuery<{ soc: number }>(
      "SELECT soc FROM batteries WHERE truckId = ?;",
      [base.truckId]
    );

    expect(truck?.currentSoc).toBeLessThan(80);
    expect(battery?.soc).toBeLessThan(80);
  });

  it("enforces 25% SOC minimum floor during transit", async () => {
    const base = await createBaseData();

    // Create battery with low SOC (30%)
    await runQuery(
      "INSERT INTO batteries (capacityKwh, soc, health, cycleCount, temperature, status, truckId) VALUES (588, 30, 95, 100, 27, 'IN_TRUCK', ?);",
      [base.truckId]
    );

    // Assign driver and start transit
    await runQuery("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
      base.truckId,
      base.driverId,
    ]);
    await runQuery("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentSoc = 30, currentStationId = NULL WHERE id = ?;", [
      base.driverId,
      base.truckId,
    ]);

    const stations = await allQuery<{ id: number; name: string }>(
      "SELECT id, name FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const stationById = new Map(stations.map((s) => [s.id, s]));

    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById,
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };

    // Run movement phase multiple times to drain SOC significantly
    for (let i = 0; i < 10; i++) {
      await runMovementPhase(context);
    }

    // Check SOC never goes below 25%
    const truck = await getQuery<{ currentSoc: number }>("SELECT currentSoc FROM trucks WHERE id = ?;", [
      base.truckId,
    ]);
    const battery = await getQuery<{ soc: number }>(
      "SELECT soc FROM batteries WHERE truckId = ?;",
      [base.truckId]
    );

    expect(truck?.currentSoc).toBeGreaterThanOrEqual(25);
    expect(battery?.soc).toBeGreaterThanOrEqual(25);
  });
});
