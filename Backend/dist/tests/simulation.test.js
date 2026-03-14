"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
const simulationRunner_1 = require("../src/services/simulationRunner");
describe("Simulation engine", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    afterEach(() => {
        (0, simulationRunner_1.stopSimulation)();
    });
    beforeEach(async () => {
        (0, simulationRunner_1.stopSimulation)();
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
            status: "ACTIVE"
        });
        const stationTwo = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 24,
            status: "ACTIVE"
        });
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Selam Transport",
            ownerName: "Alemu Bekele",
            region: "Oromia"
        });
        return {
            stationOneId: stationOne.body.station.id,
            stationTwoId: stationTwo.body.station.id,
            fleetId: fleet.body.fleet.id
        };
    }
    it("simulation moves trucks", async () => {
        const base = await createBaseData();
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-5001",
            fleetId: base.fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-5001",
            status: "READY",
            currentSoc: 70,
            currentStationId: base.stationOneId
        });
        const truckId = truckResponse.body.truck.id;
        await (0, simulationRunner_1.runSimulationCycle)(new Date("2026-03-20T12:00:00.000Z"));
        await (0, simulationRunner_1.runSimulationCycle)(new Date("2026-03-20T12:00:01.000Z"));
        const truck = await (0, connection_1.getQuery)("SELECT * FROM trucks WHERE id = ?;", [truckId]);
        expect(truck?.status).toBe("READY");
        expect(truck?.currentStationId).toBe(base.stationTwoId);
    });
    it("SOC decreases", async () => {
        const base = await createBaseData();
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-5002",
            fleetId: base.fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-5002",
            status: "IN_TRANSIT",
            currentSoc: 80,
            currentStationId: base.stationOneId
        });
        const truckId = truckResponse.body.truck.id;
        const batteryResponse = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 80,
            health: 96,
            cycleCount: 100,
            temperature: 28,
            status: "IN_TRUCK",
            truckId
        });
        const batteryId = batteryResponse.body.battery.id;
        await (0, simulationRunner_1.runSimulationCycle)(new Date("2026-03-20T12:00:00.000Z"));
        const battery = await (0, connection_1.getQuery)("SELECT * FROM batteries WHERE id = ?;", [
            batteryId
        ]);
        expect(battery?.soc).toBe(70);
    });
    it("swap events generated", async () => {
        const base = await createBaseData();
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-5003",
            fleetId: base.fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-5003",
            status: "IN_TRANSIT",
            currentSoc: 25,
            currentStationId: base.stationOneId
        });
        const truckId = truckResponse.body.truck.id;
        await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 25,
            health: 94,
            cycleCount: 210,
            temperature: 30,
            status: "IN_TRUCK",
            truckId
        });
        await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 95,
            health: 98,
            cycleCount: 40,
            temperature: 26,
            status: "READY",
            stationId: base.stationTwoId
        });
        await (0, simulationRunner_1.runSimulationCycle)(new Date("2026-03-20T12:00:00.000Z"));
        const swaps = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM swap_transactions;");
        expect(swaps?.count).toBe(1);
    });
});
