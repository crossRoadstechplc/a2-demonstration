"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
const orchestrator_1 = require("../src/services/simulation/orchestrator");
describe("Dashboard Reconciliation Tests", () => {
    let adminToken;
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
        const adminUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Admin User",
            email: "admin@test.com",
            password: "password",
            role: "ADMIN",
        });
        adminToken = adminUser.body.token;
    });
    beforeEach(async () => {
        // Clean up test data
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM shipments;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM trucks;");
        await (0, connection_1.runQuery)("DELETE FROM drivers;");
        await (0, connection_1.runQuery)("DELETE FROM fleets;");
        await (0, connection_1.runQuery)("DELETE FROM stations;");
    });
    describe("Revenue Reconciliation", () => {
        it("A2 revenue equals sum of receipts A2 share", async () => {
            // Create test data
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const fleet = await (0, supertest_1.default)(app_1.default)
                .post("/fleets")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Fleet",
                ownerName: "Test Owner",
                region: "Test Region",
            });
            const fleetId = fleet.body.fleet.id;
            const truck = await (0, supertest_1.default)(app_1.default)
                .post("/trucks")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                plateNumber: "ET-1001",
                fleetId,
                truckType: "STANDARD",
                status: "READY",
                currentSoc: 80,
                currentStationId: stationId,
            });
            const truckId = truck.body.truck.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 80,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "READY",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create swap transaction
            const swapResult = await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`, [truckId, stationId, batteryId, batteryId, new Date().toISOString()]);
            // Run simulation to create receipt
            await (0, orchestrator_1.runSimulationCycle)();
            // Get A2 dashboard data
            const a2Response = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(a2Response.status).toBe(200);
            const a2Share = a2Response.body.a2Share;
            // Get sum of receipts A2 share
            const receiptsSum = await (0, connection_1.getQuery)("SELECT COALESCE(SUM(a2Share), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');");
            expect(a2Share).toBeCloseTo(receiptsSum?.total ?? 0, 2);
        });
        it("EEU revenue equals sum of receipts EEU share", async () => {
            // Create test data (same as above)
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const fleet = await (0, supertest_1.default)(app_1.default)
                .post("/fleets")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Fleet",
                ownerName: "Test Owner",
                region: "Test Region",
            });
            const fleetId = fleet.body.fleet.id;
            const truck = await (0, supertest_1.default)(app_1.default)
                .post("/trucks")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                plateNumber: "ET-1001",
                fleetId,
                truckType: "STANDARD",
                status: "READY",
                currentSoc: 80,
                currentStationId: stationId,
            });
            const truckId = truck.body.truck.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 80,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "READY",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create swap transaction
            await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`, [truckId, stationId, batteryId, batteryId, new Date().toISOString()]);
            // Run simulation to create receipt
            await (0, orchestrator_1.runSimulationCycle)();
            // Get EEU dashboard data
            const eeuUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
                name: "EEU Operator",
                email: "eeu@test.com",
                password: "password",
                role: "EEU_OPERATOR",
            });
            const eeuToken = eeuUser.body.token;
            const eeuResponse = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/eeu?timeframe=daily")
                .set("Authorization", `Bearer ${eeuToken}`);
            expect(eeuResponse.status).toBe(200);
            const eeuRevenueShare = eeuResponse.body.eeuRevenueShare;
            // Get sum of receipts EEU share
            const receiptsSum = await (0, connection_1.getQuery)("SELECT COALESCE(SUM(eeuShare), 0) as total FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime');");
            expect(eeuRevenueShare).toBeCloseTo(receiptsSum?.total ?? 0, 2);
        });
        it("corridor revenue equals sum of receipt totals", async () => {
            // Create test data
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const fleet = await (0, supertest_1.default)(app_1.default)
                .post("/fleets")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Fleet",
                ownerName: "Test Owner",
                region: "Test Region",
            });
            const fleetId = fleet.body.fleet.id;
            const truck = await (0, supertest_1.default)(app_1.default)
                .post("/trucks")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                plateNumber: "ET-1001",
                fleetId,
                truckType: "STANDARD",
                status: "READY",
                currentSoc: 80,
                currentStationId: stationId,
            });
            const truckId = truck.body.truck.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 80,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "READY",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create swap transaction
            await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`, [truckId, stationId, batteryId, batteryId, new Date().toISOString()]);
            // Run simulation to create receipt
            await (0, orchestrator_1.runSimulationCycle)();
            // Get A2 dashboard data
            const a2Response = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(a2Response.status).toBe(200);
            const corridorRevenue = a2Response.body.corridorRevenue;
            // Get sum of receipt totals
            const receiptsSum = await (0, connection_1.getQuery)(`SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         WHERE date(st.timestamp, 'localtime') = date('now', 'localtime');`);
            expect(corridorRevenue).toBeCloseTo(receiptsSum?.total ?? 0, 2);
        });
    });
    describe("Energy Reconciliation", () => {
        it("station energy summaries match charging sessions", async () => {
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 50,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "CHARGING",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create charging session
            await (0, connection_1.runQuery)(`INSERT INTO charging_sessions 
         (batteryId, stationId, startSoc, currentSoc, targetSoc, energyAddedKwh, startTime, status)
         VALUES (?, ?, 50, 60, 95, 58.8, ?, 'ACTIVE');`, [batteryId, stationId, new Date().toISOString()]);
            // Get station dashboard data
            const stationUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
                name: "Station Operator",
                email: "station@test.com",
                password: "password",
                role: "STATION_OPERATOR",
                organizationId: String(stationId),
            });
            const stationToken = stationUser.body.token;
            const stationResponse = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/station/${stationId}`)
                .set("Authorization", `Bearer ${stationToken}`);
            expect(stationResponse.status).toBe(200);
            const energyChargingNow = stationResponse.body.energyChargingNowKwh;
            // Get sum of charging sessions energy
            const chargingSum = await (0, connection_1.getQuery)("SELECT COALESCE(SUM(energyAddedKwh), 0) as total FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE';", [stationId]);
            expect(energyChargingNow).toBeCloseTo(chargingSum?.total ?? 0, 2);
        });
    });
    describe("Swap Reconciliation", () => {
        it("swaps today match actual swap records", async () => {
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const fleet = await (0, supertest_1.default)(app_1.default)
                .post("/fleets")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Fleet",
                ownerName: "Test Owner",
                region: "Test Region",
            });
            const fleetId = fleet.body.fleet.id;
            const truck = await (0, supertest_1.default)(app_1.default)
                .post("/trucks")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                plateNumber: "ET-1001",
                fleetId,
                truckType: "STANDARD",
                status: "READY",
                currentSoc: 80,
                currentStationId: stationId,
            });
            const truckId = truck.body.truck.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 80,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "READY",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create swap transaction
            await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`, [truckId, stationId, batteryId, batteryId, new Date().toISOString()]);
            // Get A2 dashboard swaps count
            const a2Response = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(a2Response.status).toBe(200);
            const swapsToday = a2Response.body.swapsToday;
            // Get actual swap count
            const swapCount = await (0, connection_1.getQuery)("SELECT COUNT(*) as count FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime');");
            expect(swapsToday).toBe(swapCount?.count ?? 0);
        });
    });
    describe("Fleet Energy Cost Reconciliation", () => {
        it("fleet energy cost matches receipts for fleet trucks", async () => {
            const station = await (0, supertest_1.default)(app_1.default)
                .post("/stations")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Station",
                location: "Test Location",
                capacity: 100,
                status: "ACTIVE",
            });
            const stationId = station.body.station.id;
            const fleet = await (0, supertest_1.default)(app_1.default)
                .post("/fleets")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                name: "Test Fleet",
                ownerName: "Test Owner",
                region: "Test Region",
            });
            const fleetId = fleet.body.fleet.id;
            const truck = await (0, supertest_1.default)(app_1.default)
                .post("/trucks")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                plateNumber: "ET-1001",
                fleetId,
                truckType: "STANDARD",
                status: "READY",
                currentSoc: 80,
                currentStationId: stationId,
            });
            const truckId = truck.body.truck.id;
            const battery = await (0, supertest_1.default)(app_1.default)
                .post("/batteries")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                capacityKwh: 588,
                soc: 80,
                health: 95,
                cycleCount: 100,
                temperature: 28,
                status: "READY",
                stationId,
            });
            const batteryId = battery.body.battery.id;
            // Create swap transaction
            await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
         (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
         VALUES (?, ?, ?, ?, 30, 100, ?);`, [truckId, stationId, batteryId, batteryId, new Date().toISOString()]);
            // Run simulation to create receipt
            await (0, orchestrator_1.runSimulationCycle)();
            // Get fleet dashboard data
            const fleetUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
                name: "Fleet Owner",
                email: "fleet@test.com",
                password: "password",
                role: "FLEET_OWNER",
                organizationId: String(fleetId),
            });
            const fleetToken = fleetUser.body.token;
            const fleetResponse = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/fleet/${fleetId}`)
                .set("Authorization", `Bearer ${fleetToken}`);
            expect(fleetResponse.status).toBe(200);
            const fleetEnergyCost = fleetResponse.body.fleetEnergyCostEtb;
            // Get sum of receipts for fleet trucks
            const receiptsSum = await (0, connection_1.getQuery)(`SELECT COALESCE(SUM(r.total), 0) as total
         FROM receipts r
         JOIN swap_transactions st ON r.swapId = st.id
         JOIN trucks t ON st.truckId = t.id
         WHERE t.fleetId = ? AND date(r.timestamp, 'localtime') = date('now', 'localtime');`, [fleetId]);
            expect(fleetEnergyCost).toBeCloseTo(receiptsSum?.total ?? 0, 2);
        });
    });
});
