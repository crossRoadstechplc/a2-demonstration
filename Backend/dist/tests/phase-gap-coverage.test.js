"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Phase gap coverage", () => {
    beforeAll(async () => {
        await (0, connection_1.initializeDatabase)();
    });
    beforeEach(async () => {
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM battery_events;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM shipment_events;");
        await (0, connection_1.runQuery)("DELETE FROM shipments;");
        await (0, connection_1.runQuery)("DELETE FROM truck_arrivals;");
        await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
        await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
        await (0, connection_1.runQuery)("DELETE FROM driver_telemetry;");
        await (0, connection_1.runQuery)("DELETE FROM trucks;");
        await (0, connection_1.runQuery)("DELETE FROM drivers;");
        await (0, connection_1.runQuery)("DELETE FROM fleets;");
        await (0, connection_1.runQuery)("DELETE FROM stations;");
        await (0, connection_1.runQuery)("DELETE FROM users;");
    });
    async function register(role, organizationId) {
        const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const response = await (0, supertest_1.default)(app_1.default).post("/auth/register").send({
            name: `${role} User`,
            email: `${role.toLowerCase()}_${unique}@example.com`,
            password: "secret123",
            role,
            organizationId: organizationId ?? null
        });
        return { token: response.body.token, userId: response.body.user.id };
    }
    it("config endpoints enforce role and validation", async () => {
        const admin = await register("ADMIN");
        const driver = await register("DRIVER");
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .patch("/config/tariffs")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ eeuRatePerKwh: 12, a2ServiceRatePerKwh: 11, vatPercent: 16 });
        expect(forbidden.status).toBe(403);
        const invalid = await (0, supertest_1.default)(app_1.default)
            .patch("/config/tariffs")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ eeuRatePerKwh: 12 });
        expect(invalid.status).toBe(400);
        const updated = await (0, supertest_1.default)(app_1.default)
            .patch("/config/tariffs")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ eeuRatePerKwh: 12, a2ServiceRatePerKwh: 13, vatPercent: 17 });
        expect(updated.status).toBe(200);
        expect(updated.body.tariffs.eeuRatePerKwh).toBe(12);
    });
    it("user role update validates and restricts admin-only", async () => {
        const admin = await register("ADMIN");
        const a2 = await register("A2_OPERATOR");
        const target = await register("DRIVER");
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .patch(`/users/${target.userId}/role`)
            .set("Authorization", `Bearer ${a2.token}`)
            .send({ role: "ADMIN" });
        expect(forbidden.status).toBe(403);
        const invalidRole = await (0, supertest_1.default)(app_1.default)
            .patch(`/users/${target.userId}/role`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ role: "BAD_ROLE" });
        expect(invalidRole.status).toBe(400);
        const success = await (0, supertest_1.default)(app_1.default)
            .patch(`/users/${target.userId}/role`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ role: "FLEET_OWNER" });
        expect(success.status).toBe(200);
        expect(success.body.user.role).toBe("FLEET_OWNER");
    });
    it("station incidents and faults respect ownership", async () => {
        const stationOne = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 20,
            status: "ACTIVE"
        });
        const stationTwo = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Awash",
            location: "Awash",
            capacity: 14,
            status: "ACTIVE"
        });
        const stationOneId = stationOne.body.station.id;
        const stationTwoId = stationTwo.body.station.id;
        const operator = await register("STATION_OPERATOR", String(stationOneId));
        const a2 = await register("A2_OPERATOR");
        const ownCreate = await (0, supertest_1.default)(app_1.default)
            .post(`/stations/${stationOneId}/incidents`)
            .set("Authorization", `Bearer ${operator.token}`)
            .send({ type: "QUEUE", severity: "HIGH", message: "Queue overflow", status: "OPEN" });
        expect(ownCreate.status).toBe(201);
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .post(`/stations/${stationTwoId}/incidents`)
            .set("Authorization", `Bearer ${operator.token}`)
            .send({ type: "POWER", severity: "MEDIUM", message: "Power dip", status: "OPEN" });
        expect(forbidden.status).toBe(403);
        const fault = await (0, supertest_1.default)(app_1.default)
            .post(`/stations/${stationOneId}/charger-faults`)
            .set("Authorization", `Bearer ${operator.token}`)
            .send({
            chargerId: "CH-1",
            faultCode: "E-42",
            message: "Connector issue",
            status: "OPEN"
        });
        expect(fault.status).toBe(201);
        const a2View = await (0, supertest_1.default)(app_1.default)
            .get(`/stations/${stationOneId}/charger-faults`)
            .set("Authorization", `Bearer ${a2.token}`);
        expect(a2View.status).toBe(200);
        expect(a2View.body.chargerFaults.length).toBe(1);
    });
    it("fleet assign-driver flow and availability endpoint work with ownership restrictions", async () => {
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Fleet One",
            ownerName: "Owner One",
            region: "Adama"
        });
        const fleetId = fleet.body.fleet.id;
        const truck = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6001",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6001",
            status: "READY",
            currentSoc: 82
        });
        const truckId = truck.body.truck.id;
        const driver = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Abel Tesfaye",
            phone: "+251944444444",
            fleetId,
            rating: 4.5,
            status: "AVAILABLE"
        });
        const driverId = driver.body.driver.id;
        const owner = await register("FLEET_OWNER", String(fleetId));
        const wrongOwner = await register("FLEET_OWNER", String(fleetId + 999));
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .post(`/fleets/${fleetId}/assign-driver`)
            .set("Authorization", `Bearer ${wrongOwner.token}`)
            .send({ driverId, truckId });
        expect(forbidden.status).toBe(403);
        const assigned = await (0, supertest_1.default)(app_1.default)
            .post(`/fleets/${fleetId}/assign-driver`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ driverId, truckId });
        expect(assigned.status).toBe(200);
        const avail = await (0, supertest_1.default)(app_1.default)
            .patch(`/trucks/${truckId}/availability`)
            .set("Authorization", `Bearer ${owner.token}`)
            .send({ availability: "UNAVAILABLE" });
        expect(avail.status).toBe(200);
        expect(avail.body.truck.availability).toBe("UNAVAILABLE");
    });
    it("driver shipment workflow progresses accept -> pickup -> delivery", async () => {
        const station = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Modjo",
            location: "Modjo",
            capacity: 24,
            status: "ACTIVE"
        });
        const stationId = station.body.station.id;
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Workflow Fleet",
            ownerName: "Owner Workflow",
            region: "Modjo"
        });
        const fleetId = fleet.body.fleet.id;
        const truck = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6002",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6002",
            status: "READY",
            currentSoc: 70,
            currentStationId: stationId
        });
        const truckId = truck.body.truck.id;
        const driver = await (0, supertest_1.default)(app_1.default).post("/drivers").send({
            name: "Dawit Mekonnen",
            phone: "+251955555555",
            fleetId,
            rating: 4.8,
            status: "AVAILABLE"
        });
        const driverId = driver.body.driver.id;
        const driverUser = await register("DRIVER", String(driverId));
        const requestRes = await (0, supertest_1.default)(app_1.default).post("/freight/request").send({
            pickupLocation: "Modjo",
            deliveryLocation: "Dire Dawa",
            cargoDescription: "Electronics",
            weight: 2500,
            volume: 12,
            pickupWindow: "2026-03-20T08:00:00.000Z"
        });
        const shipmentId = requestRes.body.shipment.id;
        await (0, connection_1.runQuery)("UPDATE shipments SET truckId = ?, driverId = ?, status = 'ASSIGNED' WHERE id = ?;", [
            truckId,
            driverId,
            shipmentId
        ]);
        const accept = await (0, supertest_1.default)(app_1.default)
            .post(`/freight/${shipmentId}/accept`)
            .set("Authorization", `Bearer ${driverUser.token}`)
            .send({});
        expect(accept.status).toBe(200);
        expect(accept.body.shipment.status).toBe("IN_TRANSIT");
        const pickup = await (0, supertest_1.default)(app_1.default)
            .post(`/freight/${shipmentId}/pickup-confirm`)
            .set("Authorization", `Bearer ${driverUser.token}`)
            .send({});
        expect(pickup.status).toBe(200);
        expect(pickup.body.shipment.pickupConfirmedAt).toBeTruthy();
        const delivered = await (0, supertest_1.default)(app_1.default)
            .post(`/freight/${shipmentId}/delivery-confirm`)
            .set("Authorization", `Bearer ${driverUser.token}`)
            .send({});
        expect(delivered.status).toBe(200);
        expect(delivered.body.shipment.status).toBe("DELIVERED");
    });
    it("finance summaries and battery history return aggregated data", async () => {
        const admin = await register("ADMIN");
        const eeu = await register("EEU_OPERATOR");
        const station = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Semera",
            location: "Semera",
            capacity: 20,
            status: "ACTIVE"
        });
        const stationId = station.body.station.id;
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Finance Fleet",
            ownerName: "Finance Owner",
            region: "Semera"
        });
        const fleetId = fleet.body.fleet.id;
        const truck = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-6003",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-6003",
            status: "READY",
            currentSoc: 30
        });
        const truckId = truck.body.truck.id;
        const outgoing = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 30,
            health: 96,
            cycleCount: 140,
            temperature: 30,
            status: "IN_TRUCK",
            truckId
        });
        const outgoingId = outgoing.body.battery.id;
        const incoming = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 95,
            health: 98,
            cycleCount: 40,
            temperature: 25,
            status: "READY",
            stationId
        });
        const incomingId = incoming.body.battery.id;
        await (0, supertest_1.default)(app_1.default).post("/swaps").send({
            truckId,
            stationId,
            incomingBatteryId: incomingId,
            outgoingBatteryId: outgoingId,
            arrivalSoc: 20
        });
        const a2Summary = await (0, supertest_1.default)(app_1.default)
            .get("/billing/summary/a2")
            .set("Authorization", `Bearer ${admin.token}`);
        expect(a2Summary.status).toBe(200);
        expect(a2Summary.body.totalReceipts).toBeGreaterThanOrEqual(1);
        const eeuSummary = await (0, supertest_1.default)(app_1.default)
            .get("/billing/summary/eeu")
            .set("Authorization", `Bearer ${eeu.token}`);
        expect(eeuSummary.status).toBe(200);
        expect(eeuSummary.body.totalEeuShareEtb).toBeGreaterThan(0);
        const history = await (0, supertest_1.default)(app_1.default).get(`/batteries/${outgoingId}/history`);
        expect(history.status).toBe(200);
        expect(history.body.assignmentChanges.length).toBeGreaterThan(0);
        expect(history.body.swapParticipation.length).toBeGreaterThan(0);
    });
    it("freight tracking timeline and detail endpoints enforce ownership", async () => {
        const customer = await register("FREIGHT_CUSTOMER");
        const otherCustomer = await register("FREIGHT_CUSTOMER");
        const a2 = await register("A2_OPERATOR");
        const create = await (0, supertest_1.default)(app_1.default)
            .post("/freight/request")
            .set("Authorization", `Bearer ${customer.token}`)
            .send({
            pickupLocation: "Adama",
            deliveryLocation: "Awash",
            cargoDescription: "Cold goods",
            weight: 2000,
            volume: 10,
            pickupWindow: "2026-03-22T08:00:00.000Z",
            requiresRefrigeration: true,
            temperatureTarget: 4
        });
        const shipmentId = create.body.shipment.id;
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .get(`/freight/${shipmentId}`)
            .set("Authorization", `Bearer ${otherCustomer.token}`);
        expect(forbidden.status).toBe(403);
        await (0, supertest_1.default)(app_1.default)
            .post(`/freight/${shipmentId}/delivery-confirmation`)
            .set("Authorization", `Bearer ${customer.token}`)
            .send({});
        const tracking = await (0, supertest_1.default)(app_1.default)
            .get(`/freight/${shipmentId}/tracking`)
            .set("Authorization", `Bearer ${a2.token}`);
        expect(tracking.status).toBe(200);
        expect(tracking.body.timeline.length).toBeGreaterThan(0);
    });
    it("dashboard and live feed new endpoints return data", async () => {
        const station = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Live Station",
            location: "Mille",
            capacity: 18,
            status: "ACTIVE"
        });
        const stationId = station.body.station.id;
        await (0, connection_1.runQuery)(`
      INSERT INTO station_incidents (stationId, type, severity, message, status, reportedAt)
      VALUES (?, 'QUEUE', 'HIGH', 'Live incident', 'OPEN', ?);
    `, [stationId, new Date().toISOString()]);
        const customer = await register("FREIGHT_CUSTOMER");
        const freightDash = await (0, supertest_1.default)(app_1.default).get(`/dashboard/freight/${customer.userId}`);
        expect(freightDash.status).toBe(200);
        expect(freightDash.body.totalShipments).toBeDefined();
        const liveFeed = await (0, supertest_1.default)(app_1.default).get("/dashboard/a2/live-feed");
        expect(liveFeed.status).toBe(200);
        expect(liveFeed.body.incidents.length).toBeGreaterThanOrEqual(1);
    });
    it("demo utilities are protected and executable", async () => {
        const admin = await register("ADMIN");
        const driver = await register("DRIVER");
        const unauthorized = await (0, supertest_1.default)(app_1.default).post("/demo/seed").send({});
        expect(unauthorized.status).toBe(401);
        const forbidden = await (0, supertest_1.default)(app_1.default)
            .post("/demo/reset")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({});
        expect(forbidden.status).toBe(403);
        const seeded = await (0, supertest_1.default)(app_1.default)
            .post("/demo/seed")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({});
        expect(seeded.status).toBe(200);
        const scenario = await (0, supertest_1.default)(app_1.default)
            .post("/demo/scenario/charger-fault")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({});
        expect(scenario.status).toBe(200);
    });
});
