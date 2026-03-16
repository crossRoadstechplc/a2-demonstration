"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Dashboard Visibility Tests", () => {
    let adminToken;
    let fleet1Token;
    let fleet2Token;
    let station1Token;
    let station2Token;
    let driver1Token;
    let driver2Token;
    let customer1Token;
    let customer2Token;
    let eeuToken;
    let fleet1Id;
    let fleet2Id;
    let station1Id;
    let station2Id;
    let driver1Id;
    let driver2Id;
    let customer1Id;
    let customer2Id;
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
        // Create test users
        const adminUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Admin User",
            email: "admin@test.com",
            password: "password",
            role: "ADMIN",
        });
        adminToken = adminUser.body.token;
        // Create fleets
        const fleet1 = await (0, supertest_1.default)(app_1.default)
            .post("/fleets")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Fleet 1",
            ownerName: "Owner 1",
            region: "Region 1",
        });
        fleet1Id = fleet1.body.fleet.id;
        const fleet2 = await (0, supertest_1.default)(app_1.default)
            .post("/fleets")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Fleet 2",
            ownerName: "Owner 2",
            region: "Region 2",
        });
        fleet2Id = fleet2.body.fleet.id;
        // Create fleet owners
        const fleet1User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Fleet 1 Owner",
            email: "fleet1@test.com",
            password: "password",
            role: "FLEET_OWNER",
            organizationId: String(fleet1Id),
        });
        fleet1Token = fleet1User.body.token;
        const fleet2User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Fleet 2 Owner",
            email: "fleet2@test.com",
            password: "password",
            role: "FLEET_OWNER",
            organizationId: String(fleet2Id),
        });
        fleet2Token = fleet2User.body.token;
        // Create stations
        const station1 = await (0, supertest_1.default)(app_1.default)
            .post("/stations")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Station 1",
            location: "Location 1",
            capacity: 100,
            status: "ACTIVE",
        });
        station1Id = station1.body.station.id;
        const station2 = await (0, supertest_1.default)(app_1.default)
            .post("/stations")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Station 2",
            location: "Location 2",
            capacity: 100,
            status: "ACTIVE",
        });
        station2Id = station2.body.station.id;
        // Create station operators
        const station1User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Station 1 Operator",
            email: "station1@test.com",
            password: "password",
            role: "STATION_OPERATOR",
            organizationId: String(station1Id),
        });
        station1Token = station1User.body.token;
        const station2User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Station 2 Operator",
            email: "station2@test.com",
            password: "password",
            role: "STATION_OPERATOR",
            organizationId: String(station2Id),
        });
        station2Token = station2User.body.token;
        // Create drivers
        const driver1 = await (0, supertest_1.default)(app_1.default)
            .post("/drivers")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Driver 1",
            phone: "+251911111111",
            fleetId: fleet1Id,
            rating: 4.5,
            status: "AVAILABLE",
        });
        driver1Id = driver1.body.driver.id;
        const driver2 = await (0, supertest_1.default)(app_1.default)
            .post("/drivers")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
            name: "Driver 2",
            phone: "+251922222222",
            fleetId: fleet2Id,
            rating: 4.5,
            status: "AVAILABLE",
        });
        driver2Id = driver2.body.driver.id;
        const driver1User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Driver 1 User",
            email: "driver1@test.com",
            password: "password",
            role: "DRIVER",
            organizationId: String(driver1Id),
        });
        driver1Token = driver1User.body.token;
        const driver2User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Driver 2 User",
            email: "driver2@test.com",
            password: "password",
            role: "DRIVER",
            organizationId: String(driver2Id),
        });
        driver2Token = driver2User.body.token;
        // Create customers
        customer1Id = 1001;
        customer2Id = 1002;
        const customer1User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Customer 1",
            email: "customer1@test.com",
            password: "password",
            role: "FREIGHT_CUSTOMER",
            organizationId: String(customer1Id),
        });
        customer1Token = customer1User.body.token;
        const customer2User = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "Customer 2",
            email: "customer2@test.com",
            password: "password",
            role: "FREIGHT_CUSTOMER",
            organizationId: String(customer2Id),
        });
        customer2Token = customer2User.body.token;
        // Create EEU operator
        const eeuUser = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: "EEU Operator",
            email: "eeu@test.com",
            password: "password",
            role: "EEU_OPERATOR",
        });
        eeuToken = eeuUser.body.token;
    });
    describe("Fleet Dashboard Visibility", () => {
        it("fleet owner can only see their own fleet data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/fleet/${fleet1Id}`)
                .set("Authorization", `Bearer ${fleet1Token}`);
            expect(response.status).toBe(200);
            expect(response.body.fleetId).toBe(fleet1Id);
        });
        it("fleet owner cannot see another fleet's data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/fleet/${fleet2Id}`)
                .set("Authorization", `Bearer ${fleet1Token}`);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain("Forbidden");
        });
        it("admin can see any fleet's data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/fleet/${fleet1Id}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
        });
    });
    describe("Station Dashboard Visibility", () => {
        it("station operator can only see their own station data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/station/${station1Id}`)
                .set("Authorization", `Bearer ${station1Token}`);
            expect(response.status).toBe(200);
            expect(response.body.stationId).toBe(station1Id);
        });
        it("station operator cannot see another station's data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/station/${station2Id}`)
                .set("Authorization", `Bearer ${station1Token}`);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain("Forbidden");
        });
        it("admin can see any station's data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/station/${station1Id}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
        });
    });
    describe("Driver Dashboard Visibility", () => {
        it("driver can only see their own profile", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/driver/${driver1Id}`)
                .set("Authorization", `Bearer ${driver1Token}`);
            expect(response.status).toBe(200);
            expect(response.body.driverId).toBe(driver1Id);
        });
        it("driver cannot see another driver's profile", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/driver/${driver2Id}`)
                .set("Authorization", `Bearer ${driver1Token}`);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain("Forbidden");
        });
        it("admin can see any driver's profile", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/driver/${driver1Id}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
        });
    });
    describe("Freight Dashboard Visibility", () => {
        it("customer can only see their own shipments", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/freight/${customer1Id}`)
                .set("Authorization", `Bearer ${customer1Token}`);
            expect(response.status).toBe(200);
            expect(response.body.customerId).toBe(customer1Id);
        });
        it("customer cannot see another customer's shipments", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/freight/${customer2Id}`)
                .set("Authorization", `Bearer ${customer1Token}`);
            expect(response.status).toBe(403);
            expect(response.body.error).toContain("Forbidden");
        });
        it("admin can see any customer's shipments", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get(`/dashboard/freight/${customer1Id}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
        });
    });
    describe("EEU Dashboard Visibility", () => {
        it("EEU operator can see energy data", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/eeu")
                .set("Authorization", `Bearer ${eeuToken}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("totalNetworkLoad");
            expect(response.body).toHaveProperty("stationEnergy");
            expect(response.body).toHaveProperty("eeuRevenueShare");
        });
        it("EEU operator cannot access A2 dashboard", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${eeuToken}`);
            expect(response.status).toBe(403);
        });
    });
    describe("A2 Dashboard Visibility", () => {
        it("only admin and A2 operator can access A2 dashboard", async () => {
            const adminResponse = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(adminResponse.status).toBe(200);
            const fleetResponse = await (0, supertest_1.default)(app_1.default)
                .get("/dashboard/a2")
                .set("Authorization", `Bearer ${fleet1Token}`);
            expect(fleetResponse.status).toBe(403);
        });
    });
});
