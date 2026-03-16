"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Dashboard aggregation", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
        await (0, connection_1.runQuery)("UPDATE tariff_config SET eeuRatePerKwh = 10, a2ServiceRatePerKwh = 10, vatPercent = 15 WHERE id = 1;");
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
    async function setupDashboardData() {
        const stationResponse = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 24,
            status: "ACTIVE"
        });
        const stationId = stationResponse.body.station.id;
        await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Awash",
            location: "Awash",
            capacity: 14,
            status: "INACTIVE"
        });
        const fleetResponse = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Abay Logistics",
            ownerName: "Dawit Mulugeta",
            region: "Adama"
        });
        const fleetId = fleetResponse.body.fleet.id;
        const truckOne = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6601",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6601",
            status: "IN_TRANSIT",
            currentSoc: 40
        });
        const truckOneId = truckOne.body.truck.id;
        const truckTwo = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6602",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6602",
            status: "READY",
            currentSoc: 85
        });
        const truckTwoId = truckTwo.body.truck.id;
        const driverOne = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Abel Tesfaye",
            phone: "+251933333331",
            fleetId,
            rating: 4.2,
            status: "AVAILABLE"
        });
        const driverOneId = driverOne.body.driver.id;
        await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Dawit Mekonnen",
            phone: "+251933333332",
            fleetId,
            rating: 4.9,
            status: "AVAILABLE"
        });
        const outgoingBattery = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 30,
            health: 95,
            cycleCount: 210,
            temperature: 31,
            status: "IN_TRUCK",
            truckId: truckOneId
        });
        const outgoingBatteryId = outgoingBattery.body.battery.id;
        const incomingBattery = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 95,
            health: 98,
            cycleCount: 60,
            temperature: 26,
            status: "READY",
            stationId
        });
        const incomingBatteryId = incomingBattery.body.battery.id;
        const chargeBattery = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 250,
            soc: 50,
            health: 96,
            cycleCount: 120,
            temperature: 27,
            status: "READY",
            stationId
        });
        const chargeBatteryId = chargeBattery.body.battery.id;
        await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 220,
            soc: 80,
            health: 97,
            cycleCount: 90,
            temperature: 25,
            status: "READY",
            stationId
        });
        await (0, supertest_1.default)(app_1.default).post("/swaps").send({
            truckId: truckOneId,
            stationId,
            incomingBatteryId,
            outgoingBatteryId,
            arrivalSoc: 20
        });
        await (0, supertest_1.default)(app_1.default).post("/charging/start").send({
            stationId,
            batteryId: chargeBatteryId
        });
        await (0, supertest_1.default)(app_1.default).post(`/drivers/${driverOneId}/rate`).send({
            customerRating: 5,
            deliveryFeedback: "positive"
        });
        await (0, supertest_1.default)(app_1.default).post(`/drivers/${driverOneId}/telemetry`).send({
            speed: 120,
            brakeForce: 0.9,
            timestamp: new Date().toISOString()
        });
        const shipment = await (0, supertest_1.default)(app_1.default).post("/freight/request").send({
            pickupLocation: "Adama",
            deliveryLocation: "Dire Dawa",
            cargoDescription: "Medical supplies",
            weight: 3500,
            volume: 16,
            pickupWindow: "2026-03-17T08:00:00.000Z"
        });
        await (0, supertest_1.default)(app_1.default).post(`/freight/${shipment.body.shipment.id}/assign`).send({});
        const _ = truckTwoId;
        return { stationId, fleetId, driverId: driverOneId };
    }
    it("dashboard endpoints return valid data", async () => {
        const data = await setupDashboardData();
        const a2 = await (0, supertest_1.default)(app_1.default).get("/dashboard/a2");
        const station = await (0, supertest_1.default)(app_1.default).get(`/dashboard/station/${data.stationId}`);
        const fleet = await (0, supertest_1.default)(app_1.default).get(`/dashboard/fleet/${data.fleetId}`);
        const driver = await (0, supertest_1.default)(app_1.default).get(`/dashboard/driver/${data.driverId}`);
        const eeu = await (0, supertest_1.default)(app_1.default).get("/dashboard/eeu");
        expect(a2.status).toBe(200);
        expect(station.status).toBe(200);
        expect(fleet.status).toBe(200);
        expect(driver.status).toBe(200);
        expect(eeu.status).toBe(200);
        expect(a2.body.activeTrucks).toBeDefined();
        expect(station.body.batteriesAtStation).toBeDefined();
        expect(fleet.body.totalTrucks).toBeDefined();
        expect(driver.body.safetyScore).toBeDefined();
        expect(eeu.body.energySoldToday).toBeDefined();
    });
    it("aggregation numbers correct", async () => {
        const data = await setupDashboardData();
        const a2 = await (0, supertest_1.default)(app_1.default).get("/dashboard/a2");
        expect(a2.body.activeTrucks).toBe(2);
        expect(a2.body.swapsToday).toBe(1);
        expect(a2.body.batteriesReady).toBe(1);
        expect(a2.body.energyToday).toBe(225);
        expect(a2.body.incidents).toBe(1);
        expect(a2.body.stationsOnline).toBe(1);
        const station = await (0, supertest_1.default)(app_1.default).get(`/dashboard/station/${data.stationId}`);
        expect(station.body.batteriesAtStation).toBe(3);
        expect(station.body.activeChargingSessions).toBe(1);
        expect(station.body.swapsToday).toBe(1);
        expect(station.body.energyToday).toBe(225);
        const fleet = await (0, supertest_1.default)(app_1.default).get(`/dashboard/fleet/${data.fleetId}`);
        expect(fleet.body.totalTrucks).toBe(2);
        expect(fleet.body.activeTrucks).toBe(2);
        expect(fleet.body.availableDrivers).toBe(1);
        expect(fleet.body.activeShipments).toBe(1);
        const driver = await (0, supertest_1.default)(app_1.default).get(`/dashboard/driver/${data.driverId}`);
        expect(driver.body.safetyScore).toBe(92);
        expect(driver.body.speedViolations).toBe(1);
        expect(driver.body.harshBrakes).toBe(1);
        expect(driver.body.completedTrips).toBe(1);
        const eeu = await (0, supertest_1.default)(app_1.default).get("/dashboard/eeu");
        expect(eeu.body.swapsToday).toBe(1);
        expect(eeu.body.energySoldToday).toBe(225);
        expect(eeu.body.revenueToday).toBe(2250);
        expect(eeu.body.vatShareToday).toBe(337.5);
        expect(eeu.body.totalShareToday).toBe(2587.5);
        expect(eeu.body.activeStations).toBe(1);
    });
    it("A2 system health endpoint returns valid data", async () => {
        const data = await setupDashboardData();
        // Create additional test data for system health
        await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6603",
            fleetId: data.fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6603",
            status: "IDLE",
            currentSoc: 50
        });
        await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6604",
            fleetId: data.fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6604",
            status: "MAINTENANCE",
            currentSoc: 20
        });
        const systemHealth = await (0, supertest_1.default)(app_1.default).get("/dashboard/a2/system-health");
        expect(systemHealth.status).toBe(200);
        expect(systemHealth.body).toHaveProperty("stationsOnline");
        expect(systemHealth.body).toHaveProperty("stationsOffline");
        expect(systemHealth.body).toHaveProperty("trucksActive");
        expect(systemHealth.body).toHaveProperty("trucksIdle");
        expect(systemHealth.body).toHaveProperty("trucksMaintenance");
        expect(systemHealth.body).toHaveProperty("driversActive");
        expect(systemHealth.body).toHaveProperty("driversInactive");
        expect(systemHealth.body).toHaveProperty("networkUtilization");
        expect(systemHealth.body.stationsOnline).toBe(1);
        expect(systemHealth.body.stationsOffline).toBe(1);
        expect(systemHealth.body.trucksActive).toBe(2); // IN_TRANSIT + READY
        expect(systemHealth.body.trucksIdle).toBe(1);
        expect(systemHealth.body.trucksMaintenance).toBe(1);
        expect(typeof systemHealth.body.networkUtilization).toBe("number");
        expect(systemHealth.body.networkUtilization).toBeGreaterThanOrEqual(0);
        expect(systemHealth.body.networkUtilization).toBeLessThanOrEqual(100);
    });
});
