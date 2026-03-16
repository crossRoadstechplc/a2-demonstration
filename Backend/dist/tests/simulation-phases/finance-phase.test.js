"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../src/app"));
const connection_1 = require("../../src/database/connection");
const finance_phase_1 = require("../../src/services/simulation/phases/finance-phase");
describe("Finance Phase", () => {
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
    async function createSwapTransaction() {
        const station = await (0, supertest_1.default)(app_1.default).post("/stations").send({
            name: "Adama",
            location: "Adama",
            capacity: 24,
            status: "ACTIVE",
        });
        const stationId = station.body.station.id;
        const fleet = await (0, supertest_1.default)(app_1.default).post("/fleets").send({
            name: "Selam Transport",
            ownerName: "Alemu Bekele",
            region: "Oromia",
        });
        const fleetId = fleet.body.fleet.id;
        const truck = await (0, supertest_1.default)(app_1.default).post("/trucks").send({
            plateNumber: "ET-5001",
            fleetId,
            truckType: "STANDARD",
            batteryId: "BAT-5001",
            status: "READY",
            currentSoc: 70,
            currentStationId: stationId,
        });
        const truckId = truck.body.truck.id;
        // Create swap transaction without receipt
        const swapResult = await (0, connection_1.runQuery)(`INSERT INTO swap_transactions 
       (truckId, stationId, incomingBatteryId, outgoingBatteryId, arrivalSoc, energyDeliveredKwh, timestamp)
       VALUES (?, ?, 1, 2, 30, 100, ?);`, [truckId, stationId, new Date().toISOString()]);
        return swapResult.lastID;
    }
    it("creates receipt for swap without receipt", async () => {
        const swapId = await createSwapTransaction();
        const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const stationById = new Map(stations.map((s) => [s.id, s]));
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById,
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, finance_phase_1.runFinancePhase)(context);
        const receipt = await (0, connection_1.getQuery)("SELECT id, swapId, energyKwh, total, a2Share, eeuShare FROM receipts WHERE swapId = ?;", [
            swapId,
        ]);
        expect(receipt).not.toBeNull();
        expect(receipt?.swapId).toBe(swapId);
        expect(receipt?.energyKwh).toBe(100);
        expect(receipt?.total).toBeGreaterThan(0);
        expect(receipt?.a2Share).toBeGreaterThan(0);
        expect(receipt?.eeuShare).toBeGreaterThan(0);
    });
    it("calculates A2 and EEU shares correctly", async () => {
        const swapId = await createSwapTransaction();
        const stations = await (0, connection_1.allQuery)("SELECT id, name FROM stations ORDER BY id ASC;");
        const stationIds = stations.map((s) => s.id);
        const stationById = new Map(stations.map((s) => [s.id, s]));
        const context = {
            timestamp: new Date().toISOString(),
            stations,
            stationIds,
            stationById,
            truckMotionById: new Map(),
            scenarioModifiers: {},
        };
        await (0, finance_phase_1.runFinancePhase)(context);
        const receipt = await (0, connection_1.getQuery)("SELECT energyCharge, serviceCharge, vat, total, a2Share, eeuShare FROM receipts WHERE swapId = ?;", [swapId]);
        // A2 share = serviceCharge + (vat / 2)
        // EEU share = energyCharge + (vat / 2)
        // total = energyCharge + serviceCharge + vat
        expect(receipt?.a2Share).toBeCloseTo((receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
        expect(receipt?.eeuShare).toBeCloseTo((receipt?.energyCharge ?? 0) + (receipt?.vat ?? 0) / 2, 2);
        expect(receipt?.total).toBeCloseTo((receipt?.energyCharge ?? 0) + (receipt?.serviceCharge ?? 0) + (receipt?.vat ?? 0), 2);
    });
});
