"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
describe("Billing engine", () => {
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
    async function runSwapForBilling() {
        const stationRes = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Awash",
            location: "Awash",
            capacity: 20,
            status: "ACTIVE"
        });
        const stationId = stationRes.body.station.id;
        const fleetRes = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Habesha Freight",
            ownerName: "Birhanu Tesfaye",
            region: "Oromia"
        });
        const fleetId = fleetRes.body.fleet.id;
        const truckRes = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-8801",
            fleetId,
            truckType: "STANDARD",
            batteryId: "1",
            status: "READY",
            currentSoc: 30
        });
        const truckId = truckRes.body.truck.id;
        const outgoingBatteryRes = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 30,
            health: 95,
            cycleCount: 200,
            temperature: 31,
            status: "IN_TRUCK",
            truckId
        });
        const outgoingBatteryId = outgoingBatteryRes.body.battery.id;
        const incomingBatteryRes = await (0, supertest_1.default)(app_1.default).post("/batteries").send({
            capacityKwh: 300,
            soc: 90,
            health: 97,
            cycleCount: 60,
            temperature: 28,
            status: "READY",
            stationId
        });
        const incomingBatteryId = incomingBatteryRes.body.battery.id;
        const swapRes = await (0, supertest_1.default)(app_1.default).post("/swaps").send({
            truckId,
            stationId,
            incomingBatteryId,
            outgoingBatteryId,
            arrivalSoc: 20
        });
        return { swapId: swapRes.body.swap.id };
    }
    it("billing calculation correct", async () => {
        await runSwapForBilling();
        const receiptsRes = await (0, supertest_1.default)(app_1.default).get("/billing/receipts");
        const receipt = receiptsRes.body.receipts[0];
        expect(receiptsRes.status).toBe(200);
        expect(receipt.energyKwh).toBe(210);
        expect(receipt.energyCharge).toBe(2100);
        expect(receipt.serviceCharge).toBe(2100);
        expect(receipt.vat).toBe(630);
        expect(receipt.total).toBe(4830);
    });
    it("revenue split correct", async () => {
        await runSwapForBilling();
        const receiptsRes = await (0, supertest_1.default)(app_1.default).get("/billing/receipts");
        const receipt = receiptsRes.body.receipts[0];
        expect(receipt.eeuShare).toBe(2415);
        expect(receipt.a2Share).toBe(2415);
    });
    it("receipt created after swap", async () => {
        const { swapId } = await runSwapForBilling();
        const receiptsRes = await (0, supertest_1.default)(app_1.default).get("/billing/receipts");
        const receipt = receiptsRes.body.receipts[0];
        expect(receiptsRes.status).toBe(200);
        expect(receiptsRes.body.receipts.length).toBe(1);
        expect(receipt.swapId).toBe(swapId);
    });
});
