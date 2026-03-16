import request from "supertest";

import app from "../../src/app";
import { allQuery, getQuery, initializeDatabase, runQuery } from "../../src/database/connection";
import { runChargingPhase } from "../../src/services/simulation/phases/charging-phase";
import type { SimulationContext } from "../../src/services/simulation/types";

describe("Charging Phase", () => {
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

  async function createStationBatterySetup(): Promise<{
    stationId: number;
    batteryId: number;
  }> {
    const stationResponse = await request(app).post("/stations").send({
      name: "Adama",
      location: "Adama",
      capacity: 24,
      status: "ACTIVE",
    });
    const stationId = stationResponse.body.station.id as number;

    const batteryResponse = await request(app).post("/batteries").send({
      capacityKwh: 588,
      soc: 40,
      health: 97,
      cycleCount: 120,
      temperature: 29,
      status: "CHARGING",
      stationId,
    });
    const batteryId = batteryResponse.body.battery.id as number;

    return { stationId, batteryId };
  }

  it("creates charging session for battery needing charge", async () => {
    const { stationId, batteryId } = await createStationBatterySetup();

    // Set battery to READY with low SOC
    await runQuery("UPDATE batteries SET status = 'READY', soc = 50 WHERE id = ?;", [batteryId]);

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

    await runChargingPhase(context);

    const session = await getQuery<{ id: number; status: string }>(
      "SELECT id, status FROM charging_sessions WHERE batteryId = ?;",
      [batteryId]
    );

    expect(session).not.toBeNull();
    expect(session?.status).toBe("ACTIVE");
  });

  it("increases battery SOC during charging", async () => {
    const { stationId, batteryId } = await createStationBatterySetup();

    // Create active charging session
    await runQuery(
      "INSERT INTO charging_sessions (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status) VALUES (?, ?, ?, 50, 50, 95, 0, 'ACTIVE');",
      [stationId, batteryId, new Date().toISOString()]
    );

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

    await runChargingPhase(context);

    const battery = await getQuery<{ soc: number }>("SELECT soc FROM batteries WHERE id = ?;", [
      batteryId,
    ]);
    const session = await getQuery<{ currentSoc: number; energyAddedKwh: number }>(
      "SELECT currentSoc, energyAddedKwh FROM charging_sessions WHERE batteryId = ?;",
      [batteryId]
    );

    expect(battery?.soc).toBeGreaterThan(50);
    expect(session?.currentSoc).toBeGreaterThan(50);
    expect(session?.energyAddedKwh).toBeGreaterThan(0);
  });

  it("completes charging when SOC reaches 95%", async () => {
    const { stationId, batteryId } = await createStationBatterySetup();

    // Set battery to 94% SOC
    await runQuery("UPDATE batteries SET soc = 94, status = 'CHARGING' WHERE id = ?;", [batteryId]);
    await runQuery(
      "INSERT INTO charging_sessions (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status) VALUES (?, ?, ?, 50, 94, 95, 100, 'ACTIVE');",
      [stationId, batteryId, new Date().toISOString()]
    );

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

    await runChargingPhase(context);

    const battery = await getQuery<{ soc: number; status: string }>(
      "SELECT soc, status FROM batteries WHERE id = ?;",
      [batteryId]
    );
    const session = await getQuery<{ status: string; endTime: string | null }>(
      "SELECT status, endTime FROM charging_sessions WHERE batteryId = ?;",
      [batteryId]
    );

    expect(battery?.soc).toBeGreaterThanOrEqual(95);
    expect(battery?.status).toBe("READY");
    expect(session?.status).toBe("COMPLETED");
    expect(session?.endTime).not.toBeNull();
  });
});
