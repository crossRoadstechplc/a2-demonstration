import request from "supertest";

import app from "../../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../../src/database/connection";
import { runFinancePhase } from "../../src/services/simulation/phases/finance-phase";
import type { SimulationContext } from "../../src/services/simulation/types";

describe("Finance Phase", () => {
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

  async function createSwapTransaction(): Promise<number> {
    const station = await request(app).post("/stations").send({
      name: "Adama",
      location: "Adama",
      capacity: 24,
      status: "ACTIVE",
    });
    const stationId = station.body.station.id as number;

    const fleet = await request(app).post("/fleets").send({
      name: "Selam Transport",
      ownerName: "Alemu Bekele",
      region: "Oromia",
    });
    const fleetId = fleet.body.fleet.id as number;

    const truck = await request(app).post("/trucks").send({
      plateNumber: "ET-5001",
      fleetId,
      truckType: "STANDARD",
      batteryId: "BAT-5001",
      status: "READY",
      currentSoc: 70,
      currentStationId: stationId,
    });
    const truckId = truck.body.truck.id as number;

    // Create swap transaction without receipt
    const swapResult = await runQuery(
      `INSERT INTO swap_transactions 
       (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
       VALUES (?, ?, 1, 2, 30, 100, ?);`,
      [truckId, stationId, new Date().toISOString()]
    );

    return swapResult.lastID;
  }

  it("creates receipt for swap without receipt", async () => {
    const swapId = await createSwapTransaction();

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

    await runFinancePhase(context);

    const receipt = await getQuery<{
      id: number;
      swapId: number;
      energyKwh: number;
      total: number;
      a2Share: number;
      eeuShare: number;
    }>("SELECT id, swapId, energyKwh, total, a2Share, eeuShare FROM receipts WHERE swapId = ?;", [
      swapId,
    ]);

    expect(receipt).not.toBeNull();
    expect(receipt?.swapId).toBe(swapId);
    expect(receipt?.energyKwh).toBe(100);
    expect(receipt?.total).toBeGreaterThan(0);
    expect(receipt?.a2Share).toBeGreaterThan(0);
    expect(receipt?.eeuShare).toBeGreaterThan(0);
  });

  it("calculates A2 and EEU shares correctly", async () => {
    const swapId = await createSwapTransaction();

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

    await runFinancePhase(context);

    const receipt = await getQuery<{
      energyCharge: number;
      serviceCharge: number;
      vat: number;
      total: number;
      a2Share: number;
      eeuShare: number;
    }>(
      "SELECT energyCharge, serviceCharge, vat, total, a2Share, eeuShare FROM receipts WHERE swapId = ?;",
      [swapId]
    );

    // A2 share = serviceCharge + (vat / 2)
    // EEU share = energyCharge + (vat / 2)
    // total = energyCharge + serviceCharge + vat
    expect(receipt?.a2Share).toBeCloseTo((receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
    expect(receipt?.eeuShare).toBeCloseTo((receipt?.energyCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
    expect(receipt?.total).toBeCloseTo(
      (receipt?.energyCharge ?? 0) + (receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0),
      2
    );
  });
});
