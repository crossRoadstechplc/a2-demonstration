"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Swap transactions", () => {
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
    async function createSwapSetup() {
        const stationRes = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Modjo",
            location: "Modjo",
            capacity: 20,
            status: "ACTIVE"
        });
        const stationId = stationRes.body.station.id;
        const fleetRes = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Abay Logistics",
            ownerName: "Dawit Mulugeta",
            region: "Amhara"
        });
        const fleetId = fleetRes.body.fleet.id;
        const truckRes = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-7001",
            fleetId,
            truckType: "STANDARD",
            batteryId: "1",
            status: "READY",
            currentSoc: 25
        });
        const truckId = truckRes.body.truck.id;
        const outgoingBatteryRes = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 25,
            health: 95,
            cycleCount: 220,
            temperature: 32,
            status: "IN_TRUCK",
            truckId
        });
        const outgoingBatteryId = outgoingBatteryRes.body.battery.id;
        const incomingBatteryRes = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 95,
            health: 98,
            cycleCount: 40,
            temperature: 27,
            status: "READY",
            stationId
        });
        const incomingBatteryId = incomingBatteryRes.body.battery.id;
        return { truckId, stationId, incomingBatteryId, outgoingBatteryId };
    }
    it("swap transaction recorded", async () => {
        const setup = await createSwapSetup();
        const response = await (0, supertest_1.default)(app_1.default).post("/swaps").send({
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
        await (0, supertest_1.default)(app_1.default).post("/swaps").send({
            truckId: setup.truckId,
            stationId: setup.stationId,
            incomingBatteryId: setup.incomingBatteryId,
            outgoingBatteryId: setup.outgoingBatteryId,
            arrivalSoc: 20
        });
        const incoming = await (0, connection_1.getQuery)("SELECT * FROM batteries WHERE id = ?;", [
            setup.incomingBatteryId
        ]);
        const outgoing = await (0, connection_1.getQuery)("SELECT * FROM batteries WHERE id = ?;", [
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
        const response = await (0, supertest_1.default)(app_1.default).post("/swaps").send({
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
