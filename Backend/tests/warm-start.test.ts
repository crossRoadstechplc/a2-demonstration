import { allQuery, getQuery, initializeDatabase, runQuery } from "../src/database/connection";
import { seedDemoData } from "../src/database/seed";
import { runBootstrapPhase } from "../src/services/simulation/phases/bootstrap-phase";
import type { SimulationContext } from "../src/services/simulation/types";

interface CountRow {
  count: number;
}

interface BatteryRow {
  id: number;
  soc: number;
  status: string;
  stationId: number | null;
  truckId: number | null;
}

describe("Warm-start simulation", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(async () => {
    // Clean up before each test
    await runQuery("DELETE FROM battery_events;");
    await runQuery("DELETE FROM truck_arrivals;");
    await runQuery("DELETE FROM shipment_events;");
    await runQuery("DELETE FROM station_incidents;");
    await runQuery("DELETE FROM charger_faults;");
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

  it("seeds 1000 trucks", async () => {
    await seedDemoData();
    const trucks = await getQuery<CountRow>("SELECT COUNT(*) as count FROM trucks;");
    expect(trucks?.count).toBe(1000);
  });

  it("seeds batteries with SOC >= 25%", async () => {
    await seedDemoData();
    
    // Create bootstrap context
    const stations = await allQuery<{ id: number; name: string; location: string; capacity: number; status: string }>(
      "SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById: new Map(stations.map((s) => [s.id, s])),
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };
    
    await runBootstrapPhase(context);
    
    const batteries = await allQuery<BatteryRow>("SELECT id, soc, status FROM batteries;");
    expect(batteries.length).toBeGreaterThan(0);
    
    for (const battery of batteries) {
      expect(battery.soc).toBeGreaterThanOrEqual(25);
    }
  });

  it("creates READY batteries at stations", async () => {
    await seedDemoData();
    
    const stations = await allQuery<{ id: number; name: string; location: string; capacity: number; status: string }>(
      "SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById: new Map(stations.map((s) => [s.id, s])),
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };
    
    await runBootstrapPhase(context);
    
    const readyBatteries = await allQuery<BatteryRow>(
      "SELECT id, soc, status, stationId FROM batteries WHERE status = 'READY' AND stationId IS NOT NULL;"
    );
    
    expect(readyBatteries.length).toBeGreaterThan(0);
    for (const battery of readyBatteries) {
      expect(battery.status).toBe("READY");
      expect(battery.stationId).not.toBeNull();
      expect(battery.soc).toBeGreaterThanOrEqual(25);
    }
  });

  it("creates CHARGING batteries with active sessions", async () => {
    await seedDemoData();
    
    const stations = await allQuery<{ id: number; name: string; location: string; capacity: number; status: string }>(
      "SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById: new Map(stations.map((s) => [s.id, s])),
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };
    
    await runBootstrapPhase(context);
    
    const chargingBatteries = await allQuery<BatteryRow>(
      "SELECT id, soc, status, stationId FROM batteries WHERE status = 'CHARGING' AND stationId IS NOT NULL;"
    );
    
    expect(chargingBatteries.length).toBeGreaterThan(0);
    
    for (const battery of chargingBatteries) {
      expect(battery.status).toBe("CHARGING");
      expect(battery.stationId).not.toBeNull();
      expect(battery.soc).toBeGreaterThanOrEqual(25);
      
      // Verify active charging session exists
      const session = await getQuery<{ id: number; status: string }>(
        "SELECT id, status FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
        [battery.id]
      );
      expect(session).toBeDefined();
      expect(session?.status).toBe("ACTIVE");
    }
  });

  it("ensures battery state reconciliation", async () => {
    await seedDemoData();
    
    const stations = await allQuery<{ id: number; name: string; location: string; capacity: number; status: string }>(
      "SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById: new Map(stations.map((s) => [s.id, s])),
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };
    
    await runBootstrapPhase(context);
    
    // READY batteries should not be charging
    const readyBatteries = await allQuery<BatteryRow>(
      "SELECT id, status FROM batteries WHERE status = 'READY';"
    );
    for (const battery of readyBatteries) {
      const session = await getQuery<{ id: number }>(
        "SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';",
        [battery.id]
      );
      expect(session).toBeNull();
    }
    
    // CHARGING batteries should not be in trucks
    const chargingBatteries = await allQuery<BatteryRow>(
      "SELECT id, status, truckId FROM batteries WHERE status = 'CHARGING';"
    );
    for (const battery of chargingBatteries) {
      expect(battery.truckId).toBeNull();
    }
    
    // IN_TRUCK batteries should not be at stations
    const inTruckBatteries = await allQuery<BatteryRow>(
      "SELECT id, status, stationId FROM batteries WHERE status = 'IN_TRUCK';"
    );
    for (const battery of inTruckBatteries) {
      expect(battery.stationId).toBeNull();
    }
  });

  it("creates realistic battery distribution per station", async () => {
    await seedDemoData();
    
    const stations = await allQuery<{ id: number; name: string; location: string; capacity: number; status: string }>(
      "SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;"
    );
    const stationIds = stations.map((s) => s.id);
    const context: SimulationContext = {
      timestamp: new Date().toISOString(),
      stations,
      stationIds,
      stationById: new Map(stations.map((s) => [s.id, s])),
      truckMotionById: new Map(),
      scenarioModifiers: {},
    };
    
    await runBootstrapPhase(context);
    
    for (const station of stations) {
      const totalBatteries = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;",
        [station.id]
      );
      
      // Should have batteries based on station capacity
      if (station.capacity <= 18) {
        expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(100);
      } else if (station.capacity <= 25) {
        expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(200);
      } else {
        expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(300);
      }
      
      // Check distribution: should have READY, CHARGING, and possibly MAINTENANCE
      const readyCount = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'READY';",
        [station.id]
      );
      const chargingCount = await getQuery<CountRow>(
        "SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'CHARGING';",
        [station.id]
      );
      
      expect(readyCount?.count ?? 0).toBeGreaterThan(0);
      expect(chargingCount?.count ?? 0).toBeGreaterThan(0);
    }
  });
});
