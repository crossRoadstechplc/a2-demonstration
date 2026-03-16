"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAnyRole_1 = require("../../middleware/requireAnyRole");
const requireAuth_1 = require("../../middleware/requireAuth");
const scenario_service_1 = require("../../services/scenarios/scenario-service");
const demoRouter = (0, express_1.Router)();
/**
 * POST /demo/scenario/:name
 * Activate a demo scenario
 */
demoRouter.post("/demo/scenario/:name", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (req, res, next) => {
    try {
        const scenarioName = req.params.name;
        const parameters = req.body.parameters;
        // Validate scenario name
        const allScenarios = scenario_service_1.scenarioService.getAllScenarios();
        const validScenario = allScenarios.find((s) => s.name === scenarioName);
        if (!validScenario) {
            res.status(400).json({
                error: `Invalid scenario name: ${scenarioName}`,
                availableScenarios: allScenarios.map((s) => s.name),
            });
            return;
        }
        // Activate scenario
        await scenario_service_1.scenarioService.activateScenario(scenarioName, parameters);
        const activeScenario = await scenario_service_1.scenarioService.getActiveScenario();
        res.status(200).json({
            message: `Scenario '${scenarioName}' activated`,
            scenario: {
                name: activeScenario.scenarioName,
                isActive: activeScenario.isActive,
                activatedAt: activeScenario.activatedAt,
                parameters: activeScenario.parameters,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /demo/scenario
 * Get current active scenario
 */
demoRouter.get("/demo/scenario", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        const activeScenario = await scenario_service_1.scenarioService.getActiveScenario();
        const allScenarios = scenario_service_1.scenarioService.getAllScenarios();
        res.status(200).json({
            activeScenario: {
                name: activeScenario.scenarioName,
                isActive: activeScenario.isActive,
                activatedAt: activeScenario.activatedAt,
                parameters: activeScenario.parameters,
            },
            availableScenarios: allScenarios,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /demo/scenario/reset
 * Reset to normal operations
 */
demoRouter.post("/demo/scenario/reset", requireAuth_1.requireAuth, (0, requireAnyRole_1.requireAnyRole)(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
    try {
        await scenario_service_1.scenarioService.resetScenario();
        res.status(200).json({
            message: "Scenario reset to normal operations",
            scenario: {
                name: null,
                isActive: false,
                activatedAt: null,
                parameters: {},
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = demoRouter;
