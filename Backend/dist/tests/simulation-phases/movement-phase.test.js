"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
const connection_1 = require("../../src/database/connection");
const movement_phase_1 = require("../../src/services/simulation/phases/movement-phase");
describe("Movement Phase", () => {
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
    async function createBaseData() {
        const stationOne = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Modjo",
            location: "Modjo",
            capacity: 20,
            status: "ACTIVE",
        });
        const stationTwo = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 24,
            status: "ACTIVE",
        });
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Selam Transport",
            ownerName: "Alemu Bekele",
            region: "Oromia",
        });
        const driver = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Test Driver",
            phone: "+251911111111",
            fleetId: fleet.body.fleet.id,
            rating: 4.5,
            status: "AVAILABLE",
        });
        const truck = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-5001",
            fleetId: fleet.body.fleet.id,
            truckType: "STANDARD",
            batteryId: "BAT-5001",
            status: "READY",
            currentSoc: 70,
            currentStationId: stationOne.body.station.id,
        });
        return {
            stationOneId: stationOne.body.station.id,
            stationTwoId: stationTwo.body.station.id,
            fleetId: fleet.body.fleet.id,
            driverId: driver.body.driver.id,
            truckId: truck.body.truck.id,
        };
    }
    it("updates truck location during transit", async () => {
        const base = await createBaseData();
        // Assign driver to truck
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
            base.truckId,
            base.driverId,
        ]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentStationId = NULL WHERE id = ?;", [
            base.driverId,
            base.truckId,
        ]);
        // Create context
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
        // Run movement phase
        await (0, movement_phase_1.runMovementPhase)(context);
        // Check truck location was updated
        const truck = await (0, connection_1.getQuery)("SELECT locationLat, locationLng FROM trucks WHERE id = ?;", [base.truckId]);
        expect(truck?.locationLat).not.toBeNull();
        expect(truck?.locationLng).not.toBeNull();
    });
    it("drains SOC during transit", async () => {
        const base = await createBaseData();
        // Create battery for truck
        await (0, connection_1.runQuery)("INSERT INTO batteries (capacityKwh, soc, health, cycleCount, temperature, status, truckId) VALUES (588, 80, 95, 100, 27, 'IN_TRUCK', ?);", [base.truckId]);
        // Assign driver and start transit
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
            base.truckId,
            base.driverId,
        ]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentSoc = 80, currentStationId = NULL WHERE id = ?;", [
            base.driverId,
            base.truckId,
        ]);
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
        // Run movement phase
        await (0, movement_phase_1.runMovementPhase)(context);
        // Check SOC was drained
        const truck = await (0, connection_1.getQuery)("SELECT currentSoc FROM trucks WHERE id = ?;", [
            base.truckId,
        ]);
        const battery = await (0, connection_1.getQuery)("SELECT soc FROM batteries WHERE truckId = ?;", [base.truckId]);
        expect(truck?.currentSoc).toBeLessThan(80);
        expect(battery?.soc).toBeLessThan(80);
    });
    it("enforces 25% SOC minimum floor during transit", async () => {
        const base = await createBaseData();
        // Create battery with low SOC (30%)
        await (0, connection_1.runQuery)("INSERT INTO batteries (capacityKwh, soc, health, cycleCount, temperature, status, truckId) VALUES (588, 30, 95, 100, 27, 'IN_TRUCK', ?);", [base.truckId]);
        // Assign driver and start transit
        await (0, connection_1.runQuery)("UPDATE drivers SET assignedTruckId = ?, status = 'ACTIVE' WHERE id = ?;", [
            base.truckId,
            base.driverId,
        ]);
        await (0, connection_1.runQuery)("UPDATE trucks SET assignedDriverId = ?, status = 'IN_TRANSIT', currentSoc = 30, currentStationId = NULL WHERE id = ?;", [
            base.driverId,
            base.truckId,
        ]);
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
        // Run movement phase multiple times to drain SOC significantly
        for (let i = 0; i < 10; i++) {
            await (0, movement_phase_1.runMovementPhase)(context);
        }
        // Check SOC never goes below 25%
        const truck = await (0, connection_1.getQuery)("SELECT currentSoc FROM trucks WHERE id = ?;", [
            base.truckId,
        ]);
        const battery = await (0, connection_1.getQuery)("SELECT soc FROM batteries WHERE truckId = ?;", [base.truckId]);
        expect(truck?.currentSoc).toBeGreaterThanOrEqual(25);
        expect(battery?.soc).toBeGreaterThanOrEqual(25);
    });
});
