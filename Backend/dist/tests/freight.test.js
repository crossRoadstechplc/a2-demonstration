"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Freight bookings", () => {
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
    async function createAssignableFleetData() {
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Abay Logistics",
            ownerName: "Dawit Mulugeta",
            region: "Adama"
        });
        const fleetId = fleetResponse.body.fleet.id;
        await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-7701",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-7701",
            status: "READY",
            currentSoc: 88
        });
        await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Dawit Mekonnen",
            phone: "+251922222222",
            fleetId,
            rating: 4.7,
            status: "AVAILABLE"
        });
    }
    it("create freight request", async () => {
        const response = await (0, supertest_1.default)(app_1.default).post("/freight/request").send({
            pickupLocation: "Adama",
            deliveryLocation: "Dire Dawa",
            cargoDescription: "Cold medicines",
            weight: 3500,
            volume: 16,
            pickupWindow: "2026-03-15T08:00:00.000Z"
        });
        expect(response.status).toBe(201);
        expect(response.body.shipment.status).toBe("REQUESTED");
        expect(response.body.shipment.truckId).toBeNull();
        expect(response.body.shipment.driverId).toBeNull();
    });
    it("assign truck", async () => {
        await createAssignableFleetData();
        const requestResponse = await (0, supertest_1.default)(app_1.default).post("/freight/request").send({
            pickupLocation: "Adama",
            deliveryLocation: "Awash",
            cargoDescription: "Packaged food",
            weight: 4200,
            volume: 20,
            pickupWindow: "2026-03-15T10:00:00.000Z"
        });
        const shipmentId = requestResponse.body.shipment.id;
        const assignResponse = await (0, supertest_1.default)(app_1.default).post(`/freight/${shipmentId}/assign`).send({});
        expect(assignResponse.status).toBe(200);
        expect(assignResponse.body.shipment.truckId).toBeDefined();
        expect(assignResponse.body.shipment.driverId).toBeDefined();
    });
    it("update shipment status", async () => {
        await createAssignableFleetData();
        const requestResponse = await (0, supertest_1.default)(app_1.default).post("/freight/request").send({
            pickupLocation: "Adama",
            deliveryLocation: "Modjo",
            cargoDescription: "Spare parts",
            weight: 2800,
            volume: 11,
            pickupWindow: "2026-03-16T06:00:00.000Z"
        });
        const shipmentId = requestResponse.body.shipment.id;
        const assignResponse = await (0, supertest_1.default)(app_1.default).post(`/freight/${shipmentId}/assign`).send({});
        expect(assignResponse.status).toBe(200);
        expect(assignResponse.body.shipment.status).toBe("ASSIGNED");
    });
});
