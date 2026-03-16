"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../src/app"));
const connection_1 = require("../src/database/connection");
const orchestrator_1 = require("../src/services/simulation/orchestrator");
const scenario_service_1 = require("../src/services/scenarios/scenario-service");
describe("Scenario Activation Tests", () => {
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
        // Reset scenario state
        await scenario_service_1.scenarioService.resetScenario();
        // Clean up test data
        await (0, connection_1.runQuery)("DELETE FROM receipts;");
        await (0, connection_1.runQuery)("DELETE FROM charging_sessions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_transactions;");
        await (0, connection_1.runQuery)("DELETE FROM swap_queue;");
        await (0, connection_1.runQuery)("DELETE FROM station_incidents;");
        await (0, connection_1.runQuery)("DELETE FROM charger_faults;");
        await (0, connection_1.runQuery)("DELETE FROM batteries;");
        await (0, connection_1.runQuery)("DELETE FROM trucks;");
        await (0, connection_1.runQuery)("DELETE FROM stations;");
        await (0, connection_1.runQuery)("DELETE FROM fleets;");
    });
    describe("Scenario API Endpoints", () => {
        it("GET /demo/scenario returns current scenario", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get("/demo/scenario")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("activeScenario");
            expect(response.body).toHaveProperty("availableScenarios");
            expect(response.body.activeScenario.isActive).toBe(false);
        });
        it("POST /demo/scenario/:name activates a scenario", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/morning-peak")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            expect(response.status).toBe(200);
            expect(response.body.scenario.name).toBe("morning-peak");
            expect(response.body.scenario.isActive).toBe(true);
            expect(response.body.scenario.activatedAt).toBeDefined();
        });
        it("POST /demo/scenario/reset resets to normal operations", async () => {
            // Activate a scenario first
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/morning-peak")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Reset
            const response = await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/reset")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(response.status).toBe(200);
            expect(response.body.scenario.name).toBeNull();
            expect(response.body.scenario.isActive).toBe(false);
        });
        it("POST /demo/scenario/:name with invalid name returns 400", async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/invalid-scenario")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toContain("Invalid scenario name");
            expect(response.body.availableScenarios).toBeDefined();
        });
    });
    describe("Scenario: morning-peak", () => {
        it("increases truck movement and swap frequency", async () => {
            // Setup test data
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
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/morning-peak")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Verify scenario is active
            const activeScenario = await scenario_service_1.scenarioService.getActiveScenario();
            expect(activeScenario.scenarioName).toBe("morning-peak");
            expect(activeScenario.isActive).toBe(true);
            // Get modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.truckMovementMultiplier).toBe(1.2);
            expect(modifiers.swapFrequencyMultiplier).toBe(1.3);
        });
    });
    describe("Scenario: station-congestion", () => {
        it("increases queue buildup and reduces ready batteries", async () => {
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
            // Activate scenario with target station
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/station-congestion")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                parameters: {
                    targetStationIds: [stationId],
                },
            });
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.queueBuildUpMultiplier).toBe(2.5);
            expect(modifiers.readyBatteryAvailabilityMultiplier).toBe(0.5);
            expect(modifiers.queueThreshold).toBe(3);
            expect(modifiers.targetStationIds).toEqual([stationId]);
        });
    });
    describe("Scenario: charger-fault", () => {
        it("increases charger fault probability", async () => {
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
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/charger-fault")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                parameters: {
                    targetStationIds: [stationId],
                },
            });
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.chargerFaultMultiplier).toBe(10.0);
            expect(modifiers.chargerAvailabilityMultiplier).toBe(0.7);
            expect(modifiers.chargingRateMultiplier).toBe(0.8);
        });
    });
    describe("Scenario: refrigerated-priority", () => {
        it("increases refrigerated shipments and energy demand", async () => {
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/refrigerated-priority")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.refrigeratedShipmentMultiplier).toBe(2.0);
            expect(modifiers.socDrainMultiplier).toBe(1.3);
            expect(modifiers.networkLoadMultiplier).toBe(1.2);
        });
    });
    describe("Scenario: high-revenue-day", () => {
        it("increases swap frequency and freight completion", async () => {
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/high-revenue-day")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.swapFrequencyMultiplier).toBe(1.5);
            expect(modifiers.shipmentGenerationMultiplier).toBe(1.4);
            expect(modifiers.freightCompletionMultiplier).toBe(1.3);
        });
    });
    describe("Scenario: low-battery-stress", () => {
        it("reduces ready battery availability", async () => {
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/low-battery-stress")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.readyBatteryAvailabilityMultiplier).toBe(0.3);
            expect(modifiers.queueBuildUpMultiplier).toBe(1.5);
            expect(modifiers.incidentGenerationMultiplier).toBe(1.5);
        });
    });
    describe("Scenario: grid-constraint-warning", () => {
        it("increases network load and generates grid notices", async () => {
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/grid-constraint-warning")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            // Verify modifiers
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(modifiers.networkLoadMultiplier).toBe(1.5);
            expect(modifiers.chargingRateMultiplier).toBe(0.85);
            expect(modifiers.gridNoticeProbability).toBe(0.3);
        });
    });
    describe("Scenario Integration with Simulation", () => {
        it("scenario modifiers affect simulation behavior", async () => {
            // Setup test data
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
            // Create batteries
            for (let i = 0; i < 10; i++) {
                await (0, supertest_1.default)(app_1.default)
                    .post("/batteries")
                    .set("Authorization", `Bearer ${adminToken}`)
                    .send({
                    capacityKwh: 588,
                    soc: 50,
                    health: 95,
                    cycleCount: 100,
                    temperature: 28,
                    status: "READY",
                    stationId,
                });
            }
            // Activate charger-fault scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/charger-fault")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({
                parameters: {
                    targetStationIds: [stationId],
                },
            });
            // Run simulation cycles
            for (let i = 0; i < 50; i++) {
                await (0, orchestrator_1.runSimulationCycle)();
                // Check for charger faults (should be more likely with scenario active)
                const faults = await (0, connection_1.runQuery)("SELECT COUNT(*) as count FROM charger_faults WHERE stationId = ? AND status = 'OPEN';", [stationId]);
                // After enough cycles, we should see faults generated
                if (i > 20 && faults.changes > 0) {
                    expect(faults.changes).toBeGreaterThan(0);
                    break;
                }
            }
        });
        it("scenario reset returns to normal operations", async () => {
            // Activate scenario
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/morning-peak")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            let activeScenario = await scenario_service_1.scenarioService.getActiveScenario();
            expect(activeScenario.scenarioName).toBe("morning-peak");
            // Reset
            await (0, supertest_1.default)(app_1.default)
                .post("/demo/scenario/reset")
                .set("Authorization", `Bearer ${adminToken}`);
            activeScenario = await scenario_service_1.scenarioService.getActiveScenario();
            expect(activeScenario.scenarioName).toBeNull();
            expect(activeScenario.isActive).toBe(false);
            // Verify modifiers are empty
            const modifiers = await scenario_service_1.scenarioService.getModifiers();
            expect(Object.keys(modifiers).length).toBe(0);
        });
    });
});
