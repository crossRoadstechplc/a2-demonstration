"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../src/database/connection");
const seed_1 = require("../src/database/seed");
const bootstrap_phase_1 = require("../src/services/simulation/phases/bootstrap-phase");
describe("Warm-start simulation", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
        // Clean up before each test
        await (0, connection_1.runQuery)("DELETE FROM battery_events;");
        await (0, connection_1.runQuery)("DELETE FROM truck_arrivals;");
        await (0, connection_1.runQuery)("DELETE FROM shipment_events;");
        await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
        await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM shipments;");
        await (0, connection_1.runQuery)("DELETE FROM driver_telemetry;");
        await (0, connection_1.runQuery)("DELETE FROM trucks;");
        await (0, connection_1.runQuery)("DELETE FROM drivers;");
        await (0, connection_1.runQuery)("DELETE FROM fleets;");
        await (0, connection_1.runQuery)("DELETE FROM stations;");
    });
    it("seeds 1000 trucks", async () => {
        await (0, seed_1.seedDemoData)();
        const trucks = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM trucks;");
        expect(trucks?.count).toBe(1000);
    });
    it("seeds batteries with SOC >= 25%", async () => {
        await (0, seed_1.seedDemoData)();
        // Create bootstrap context
        const stations = await (0, connection_1.allQuery)("SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById: new Map(stations.map((s) => [s.id, s])),
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        const batteries = await (0, connection_1.allQuery)("SELECT id, soc, status FROM batteries;");
        expect(batteries.length).toBeGreaterThan(0);
        for (const battery of batteries) {
            expect(battery.soc).toBeGreaterThanOrEqual(25);
        }
    });
    it("creates READY batteries at stations", async () => {
        await (0, seed_1.seedDemoData)();
        const stations = await (0, connection_1.allQuery)("SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById: new Map(stations.map((s) => [s.id, s])),
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        const readyBatteries = await (0, connection_1.allQuery)("SELECT id, soc, status, stationId FROM batteries WHERE status = 'READY' AND stationId IS NOT NULL;");
        expect(readyBatteries.length).toBeGreaterThan(0);
        for (const battery of readyBatteries) {
            expect(battery.status).toBe("READY");
            expect(battery.stationId).not.toBeNull();
            expect(battery.soc).toBeGreaterThanOrEqual(25);
        }
    });
    it("creates CHARGING batteries with active sessions", async () => {
        await (0, seed_1.seedDemoData)();
        const stations = await (0, connection_1.allQuery)("SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById: new Map(stations.map((s) => [s.id, s])),
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        const chargingBatteries = await (0, connection_1.allQuery)("SELECT id, soc, status, stationId FROM batteries WHERE status = 'CHARGING' AND stationId IS NOT NULL;");
        expect(chargingBatteries.length).toBeGreaterThan(0);
        for (const battery of chargingBatteries) {
            expect(battery.status).toBe("CHARGING");
            expect(battery.stationId).not.toBeNull();
            expect(battery.soc).toBeGreaterThanOrEqual(25);
            // Verify active charging session exists
            const session = await (0, connection_1.getQuery)("SELECT id, status FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';", [battery.id]);
            expect(session).toBeDefined();
            expect(session?.status).toBe("ACTIVE");
        }
    });
    it("ensures battery state reconciliation", async () => {
        await (0, seed_1.seedDemoData)();
        const stations = await (0, connection_1.allQuery)("SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById: new Map(stations.map((s) => [s.id, s])),
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        // READY batteries should not be charging
        const readyBatteries = await (0, connection_1.allQuery)("SELECT id, status FROM batteries WHERE status = 'READY';");
        for (const battery of readyBatteries) {
            const session = await (0, connection_1.getQuery)("SELECT id FROM charging_sessions WHERE batteryId = ? AND status = 'ACTIVE';", [battery.id]);
            expect(session).toBeNull();
        }
        // CHARGING batteries should not be in trucks
        const chargingBatteries = await (0, connection_1.allQuery)("SELECT id, status, truckId FROM batteries WHERE status = 'CHARGING';");
        for (const battery of chargingBatteries) {
            expect(battery.truckId).toBeNull();
        }
        // IN_TRUCK batteries should not be at stations
        const inTruckBatteries = await (0, connection_1.allQuery)("SELECT id, status, stationId FROM batteries WHERE status = 'IN_TRUCK';");
        for (const battery of inTruckBatteries) {
            expect(battery.stationId).toBeNull();
        }
    });
    it("creates realistic battery distribution per station", async () => {
        await (0, seed_1.seedDemoData)();
        const stations = await (0, connection_1.allQuery)("SELECT id, name, location, capacity, status FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById: new Map(stations.map((s) => [s.id, s])),
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, bootstrap_phase_1.runBootstrapPhase)(context);
        for (const station of stations) {
            const totalBatteries = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM batteries WHERE stationId = ?;", [station.id]);
            // Should have batteries based on station capacity
            if (station.capacity <= 18) {
                expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(100);
            }
            else if (station.capacity <= 25) {
                expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(200);
            }
            else {
                expect(totalBatteries?.count ?? 0).toBeGreaterThanOrEqual(300);
            }
            // Check distribution: should have READY, CHARGING, and possibly MAINTENANCE
            const readyCount = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'READY';", [station.id]);
            const chargingCount = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM batteries WHERE stationId = ? AND status = 'CHARGING';", [station.id]);
            expect(readyCount?.count ?? 0).toBeGreaterThan(0);
            expect(chargingCount?.count ?? 0).toBeGreaterThan(0);
        }
    });
});
