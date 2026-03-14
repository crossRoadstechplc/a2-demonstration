"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Corridor entities", () => {
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
    it("creates station", async () => {
        const response = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Station Alpha",
            location: "Lusaka",
            capacity: 20,
            status: "ACTIVE"
        });
        expect(response.status).toBe(201);
        expect(response.body.station.name).toBe("Station Alpha");
    });
    it("creates fleet", async () => {
        const response = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Fleet One",
            ownerName: "Owner One",
            region: "North"
        });
        expect(response.status).toBe(201);
        expect(response.body.fleet.name).toBe("Fleet One");
    });
    it("creates truck", async () => {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Fleet Truck",
            ownerName: "Fleet Owner",
            region: "Central"
        });
        const fleetId = fleetResponse.body.fleet.id;
        const response = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ABC-1234",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-001",
            status: "READY",
            currentSoc: 82.5
        });
        expect(response.status).toBe(201);
        expect(response.body.truck.plateNumber).toBe("ABC-1234");
        expect(response.body.truck.fleetId).toBe(fleetId);
    });
    it("creates driver", async () => {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Fleet Driver",
            ownerName: "Owner Driver",
            region: "East"
        });
        const fleetId = fleetResponse.body.fleet.id;
        const response = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Driver One",
            phone: "+260700000001",
            fleetId,
            rating: 4.8,
            status: "AVAILABLE"
        });
        expect(response.status).toBe(201);
        expect(response.body.driver.name).toBe("Driver One");
        expect(response.body.driver.fleetId).toBe(fleetId);
    });
});
