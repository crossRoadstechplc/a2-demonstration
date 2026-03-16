import { Router } from "express";

import { requireAnyRole } from "../../middleware/requireAnyRole";
import { requireAuth } from "../../middleware/requireAuth";
import { scenarioService, type ScenarioName } from "../../services/scenarios/scenario-service";

const demoRouter = Router();

/**
 * POST /demo/scenario/:name
 * Activate a demo scenario
 */
demoRouter.post(
  "/demo/scenario/:name",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    try {
      const scenarioName = req.params.name as ScenarioName;
      const parameters = req.body.parameters as Record<string, unknown> | undefined;

      // Validate scenario name
      const allScenarios = scenarioService.getAllScenarios();
      const validScenario = allScenarios.find((s) => s.name === scenarioName);

      if (!validScenario) {
        res.status(400).json({
          error: `Invalid scenario name: ${scenarioName}`,
          availableScenarios: allScenarios.map((s) => s.name),
        });
        return;
      }

      // Activate scenario
      await scenarioService.activateScenario(scenarioName, parameters);

      const activeScenario = await scenarioService.getActiveScenario();

      res.status(200).json({
        message: `Scenario '${scenarioName}' activated`,
        scenario: {
          name: activeScenario.scenarioName,
          isActive: activeScenario.isActive,
          activatedAt: activeScenario.activatedAt,
          parameters: activeScenario.parameters,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /demo/scenario
 * Get current active scenario
 */
demoRouter.get("/demo/scenario", requireAuth, requireAnyRole(["ADMIN", "A2_OPERATOR"]), async (_req, res, next) => {
  try {
    const activeScenario = await scenarioService.getActiveScenario();
    const allScenarios = scenarioService.getAllScenarios();

    res.status(200).json({
      activeScenario: {
        name: activeScenario.scenarioName,
        isActive: activeScenario.isActive,
        activatedAt: activeScenario.activatedAt,
        parameters: activeScenario.parameters,
      },
      availableScenarios: allScenarios,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /demo/scenario/reset
 * Reset to normal operations
 */
demoRouter.post(
  "/demo/scenario/reset",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR"]),
  async (_req, res, next) => {
    try {
      await scenarioService.resetScenario();

      res.status(200).json({
        message: "Scenario reset to normal operations",
        scenario: {
          name: null,
          isActive: false,
          activatedAt: null,
          parameters: {},
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default demoRouter;
