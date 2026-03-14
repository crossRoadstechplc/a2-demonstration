"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Refrigerated trucks", () => {
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
    async function createFleet() {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Cold Chain Fleet",
            ownerName: "Mekonnen Taye",
            region: "Addis Ababa"
        });
        return fleetResponse.body.fleet.id;
    }
    it("refrigerated truck stored", async () => {
        const fleetId = await createFleet();
        const createResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-9901",
            fleetId,
            truckType: "REFRIGERATED",
            batteryId: "BAT-9901",
            status: "READY",
            currentSoc: 88,
            refrigerationPowerDraw: 12,
            temperatureTarget: 4,
            temperatureCurrent: 6
        });
        expect(createResponse.status).toBe(201);
        expect(createResponse.body.truck.truckType).toBe("REFRIGERATED");
        expect(createResponse.body.truck.refrigerationPowerDraw).toBe(12);
        const listResponse = await (0, supertest_1.default)(app_1.default).get("/trucks/refrigerated");
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.trucks.length).toBe(1);
        expect(listResponse.body.trucks[0].plateNumber).toBe("ET-9901");
    });
    it("extra power consumption calculated", async () => {
        const stationResponse = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Dire Dawa",
            location: "Dire Dawa",
            capacity: 18,
            status: "ACTIVE"
        });
        const stationId = stationResponse.body.station.id;
        const fleetId = await createFleet();
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-9902",
            fleetId,
            truckType: "REFRIGERATED",
            batteryId: "BAT-9902",
            status: "READY",
            currentSoc: 35,
            refrigerationPowerDraw: 12,
            temperatureTarget: 4,
            temperatureCurrent: 5
        });
        const truckId = truckResponse.body.truck.id;
        const outgoingBatteryResponse = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 30,
            health: 95,
            cycleCount: 200,
            temperature: 32,
            status: "IN_TRUCK",
            truckId
        });
        const outgoingBatteryId = outgoingBatteryResponse.body.battery.id;
        const incomingBatteryResponse = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 95,
            health: 98,
            cycleCount: 40,
            temperature: 27,
            status: "READY",
            stationId
        });
        const incomingBatteryId = incomingBatteryResponse.body.battery.id;
        const swapResponse = await (0, supertest_1.default)(app_1.default).post("/swaps").send({
            truckId,
            stationId,
            incomingBatteryId,
            outgoingBatteryId,
            arrivalSoc: 20
        });
        expect(swapResponse.status).toBe(201);
        expect(swapResponse.body.swap.energyDeliveredKwh).toBe(237);
    });
    it("temperature updated", async () => {
        const fleetId = await createFleet();
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-9903",
            fleetId,
            truckType: "REFRIGERATED",
            batteryId: "BAT-9903",
            status: "READY",
            currentSoc: 70,
            refrigerationPowerDraw: 10,
            temperatureTarget: 5,
            temperatureCurrent: 8
        });
        const truckId = truckResponse.body.truck.id;
        const patchResponse = await (0, supertest_1.default)(app_1.default).patch(`/trucks/${truckId}/temperature`).send({
            temperatureCurrent: 3
        });
        expect(patchResponse.status).toBe(200);
        expect(patchResponse.body.truck.temperatureCurrent).toBe(3);
        expect(patchResponse.body.truck.temperatureTarget).toBe(5);
    });
});
