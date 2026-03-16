"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Driver self truck assignment", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
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
        await (0, connection_1.runQuery)("DELETE FROM users;");
    });
    async function registerDriverUser(driverId) {
        const registerResponse = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Driver User",
            email: `driver-${driverId}@example.com`,
            password: "secret123",
            role: "DRIVER",
            organizationId: String(driverId)
        });
        return registerResponse.body.token;
    }
    async function createFleet(name) {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name,
            ownerName: "Owner",
            region: "Addis Ababa"
        });
        return fleetResponse.body.fleet.id;
    }
    async function createDriver(fleetId, name) {
        const driverResponse = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name,
            phone: `+2519${Math.floor(10000000 + Math.random() * 89999999)}`,
            fleetId,
            rating: 4.5,
            status: "AVAILABLE"
        });
        return driverResponse.body.driver.id;
    }
    async function createTruck(fleetId, plateNumber) {
        const truckResponse = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber,
            fleetId,
            truckType: "STANDARD",
            batteryId: `BAT-${plateNumber}`,
            status: "READY",
            currentSoc: 80
        });
        return truckResponse.body.truck.id;
    }
    it("attaches truck by license plate for logged-in driver", async () => {
        const fleetId = await createFleet("Selam Transport");
        const driverId = await createDriver(fleetId, "Abel");
        await createTruck(fleetId, "ET-5555");
        const token = await registerDriverUser(driverId);
        const response = await (0, supertest_1.default)(app_1.default)
            .post("/drivers/me/attach-truck")
            .set("Authorization", `Bearer ${token}`)
            .send({ code: "et-5555" });
        expect(response.status).toBe(200);
        expect(response.body.driver.assignedTruckId).toBeTruthy();
        expect(response.body.truck.plateNumber).toBe("ET-5555");
        expect(response.body.truck.assignedDriverId).toBe(driverId);
    });
    it("blocks attach for truck from different fleet", async () => {
        const fleetA = await createFleet("Fleet A");
        const fleetB = await createFleet("Fleet B");
        const driverId = await createDriver(fleetA, "Biruk");
        await createTruck(fleetB, "ET-7777");
        const token = await registerDriverUser(driverId);
        const response = await (0, supertest_1.default)(app_1.default)
            .post("/drivers/me/attach-truck")
            .set("Authorization", `Bearer ${token}`)
            .send({ code: "ET-7777" });
        expect(response.status).toBe(403);
    });
    it("detaches current truck for logged-in driver", async () => {
        const fleetId = await createFleet("Fleet C");
        const driverId = await createDriver(fleetId, "Dawit");
        const truckId = await createTruck(fleetId, "ET-8888");
        const token = await registerDriverUser(driverId);
        await (0, supertest_1.default)(app_1.default)
            .post("/drivers/me/attach-truck")
            .set("Authorization", `Bearer ${token}`)
            .send({ code: "ET-8888" });
        const response = await (0, supertest_1.default)(app_1.default)
            .post("/drivers/me/detach-truck")
            .set("Authorization", `Bearer ${token}`)
            .send({});
        expect(response.status).toBe(200);
        expect(response.body.driver.assignedTruckId).toBeNull();
        expect(response.body.truck.id).toBe(truckId);
        expect(response.body.truck.assignedDriverId).toBeNull();
    });
});
