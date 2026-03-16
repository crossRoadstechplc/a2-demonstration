"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
const connection_1 = require("../../src/database/connection");
const charging_phase_1 = require("../../src/services/simulation/phases/charging-phase");
describe("Charging Phase", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
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
    async function createStationBatterySetup() {
        const stationResponse = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 24,
            status: "ACTIVE",
        });
        const stationId = stationResponse.body.station.id;
        const batteryResponse = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 588,
            soc: 40,
            health: 97,
            cycleCount: 120,
            temperature: 29,
            status: "CHARGING",
            stationId,
        });
        const batteryId = batteryResponse.body.battery.id;
        return { stationId, batteryId };
    }
    it("creates charging session for battery needing charge", async () => {
        const { stationId, batteryId } = await createStationBatterySetup();
        // Set battery to READY with low SOC
        await (0, connection_1.runQuery)("UPDATE batteries SET status = 'READY', soc = 50 WHERE id = ?;", [batteryId]);
        const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const stationById = new Map(stations.map((s) => [s.id, s]));
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById,
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, charging_phase_1.runChargingPhase)(context);
        const session = await (0, connection_1.getQuery)("SELECT id, status FROM charging_sessions WHERE batteryId = ?;", [batteryId]);
        expect(session).not.toBeNull();
        expect(session?.status).toBe("ACTIVE");
    });
    it("increases battery SOC during charging", async () => {
        const { stationId, batteryId } = await createStationBatterySetup();
        // Create active charging session
        await (0, connection_1.runQuery)("INSERT INTO charging_sessions (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status) VALUES (?, ?, ?, 50, 50, 95, 0, 'ACTIVE');", [stationId, batteryId, new Date().toISOString()]);
        const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const stationById = new Map(stations.map((s) => [s.id, s]));
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById,
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, charging_phase_1.runChargingPhase)(context);
        const battery = await (0, connection_1.getQuery)("SELECT soc FROM batteries WHERE id = ?;", [
            batteryId,
        ]);
        const session = await (0, connection_1.getQuery)("SELECT currentSoc, energyAddedKwh FROM charging_sessions WHERE batteryId = ?;", [batteryId]);
        expect(battery?.soc).toBeGreaterThan(50);
        expect(session?.currentSoc).toBeGreaterThan(50);
        expect(session?.energyAddedKwh).toBeGreaterThan(0);
    });
    it("completes charging when SOC reaches 95%", async () => {
        const { stationId, batteryId } = await createStationBatterySetup();
        // Set battery to 94% SOC
        await (0, connection_1.runQuery)("UPDATE batteries SET soc = 94, status = 'CHARGING' WHERE id = ?;", [batteryId]);
        await (0, connection_1.runQuery)("INSERT INTO charging_sessions (stationId, batteryId, startTime, startSoc, currentSoc, targetSoc, energyAddedKwh, status) VALUES (?, ?, ?, 50, 94, 95, 100, 'ACTIVE');", [stationId, batteryId, new Date().toISOString()]);
        const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const stationById = new Map(stations.map((s) => [s.id, s]));
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById,
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, charging_phase_1.runChargingPhase)(context);
        const battery = await (0, connection_1.getQuery)("SELECT soc, status FROM batteries WHERE id = ?;", [batteryId]);
        const session = await (0, connection_1.getQuery)("SELECT status, endTime FROM charging_sessions WHERE batteryId = ?;", [batteryId]);
        expect(battery?.soc).toBeGreaterThanOrEqual(95);
        expect(battery?.status).toBe("READY");
        expect(session?.status).toBe("COMPLETED");
        expect(session?.endTime).not.toBeNull();
    });
});
