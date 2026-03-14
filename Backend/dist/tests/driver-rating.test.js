"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Driver rating and telemetry", () => {
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
    async function createDriver() {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Selam Transport",
            ownerName: "Alemu Bekele",
            region: "Addis Ababa"
        });
        const fleetId = fleetResponse.body.fleet.id;
        const driverResponse = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Abel Tesfaye",
            phone: "+251911111111",
            fleetId,
            rating: 4,
            status: "AVAILABLE"
        });
        return driverResponse.body.driver.id;
    }
    it("rating stored", async () => {
        const driverId = await createDriver();
        const response = await (0, supertest_1.default)(app_1.default).post(`/drivers/${driverId}/rate`).send({
            customerRating: 5,
            deliveryFeedback: "positive"
        });
        expect(response.status).toBe(200);
        expect(response.body.driver.customerRating).toBe(5);
        expect(response.body.driver.completedTrips).toBe(1);
        expect(response.body.driver.tripEfficiency).toBe(82);
    });
    it("safety score updated", async () => {
        const driverId = await createDriver();
        const response = await (0, supertest_1.default)(app_1.default).post(`/drivers/${driverId}/telemetry`).send({
            speed: 120,
            brakeForce: 0.95,
            timestamp: new Date().toISOString()
        });
        expect(response.status).toBe(200);
        expect(response.body.driver.safetyScore).toBe(92);
    });
    it("speed violation counted", async () => {
        const driverId = await createDriver();
        const response = await (0, supertest_1.default)(app_1.default).post(`/drivers/${driverId}/telemetry`).send({
            speed: 130,
            brakeForce: 0.2,
            timestamp: new Date().toISOString()
        });
        expect(response.status).toBe(200);
        expect(response.body.driver.speedViolations).toBe(1);
    });
});
