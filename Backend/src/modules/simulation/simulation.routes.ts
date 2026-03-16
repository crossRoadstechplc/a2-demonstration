import { Router } from "express";

import { requireAuth } from "../../middleware/requireAuth";
import { requireAnyRole } from "../../middleware/requireAnyRole";
import { runQuery } from "../../database/connection";
import {
  isSimulationRunning,
  runSimulationCycle,
  startSimulation,
  stopSimulation
} from "../../services/simulationRunner";

const simulationRouter = Router();

simulationRouter.get("/simulation/status", (_req, res) => {
  res.status(200).json({
    running: isSimulationRunning()
  });
});

simulationRouter.post("/simulation/start", (_req, res) => {
  const started = startSimulation();
  res.status(200).json({
    running: isSimulationRunning(),
    message: started ? "Simulation started" : "Simulation already running"
  });
});

simulationRouter.post("/simulation/stop", (_req, res) => {
  const stopped = stopSimulation();
  res.status(200).json({
    running: isSimulationRunning(),
    message: stopped ? "Simulation stopped" : "Simulation already stopped"
  });
});

/**
 * POST /simulation/reset
 *
 * Clears simulation data (batteries, swaps, receipts, etc.) so the next
 * simulation cycle runs bootstrap and creates fresh data with correct
 * battery counts, READY distribution, and revenue.
 *
 * Use this when you've applied bootstrap fixes but still see old values -
 * the bootstrap only runs when battery count is 0.
 */
simulationRouter.post(
  "/simulation/reset",
  requireAuth,
  requireAnyRole(["ADMIN", "A2_OPERATOR"]),
  async (_req, res, next) => {
    try {
      // Clear simulation data in correct order (respect FKs)
      await runQuery("DELETE FROM receipts;");
      await runQuery("DELETE FROM charging_sessions;");
      await runQuery("DELETE FROM swap_transactions;");
      await runQuery("DELETE FROM battery_events;");
      await runQuery("DELETE FROM batteries;");
      await runQuery("DELETE FROM shipment_events;");
      await runQuery("DELETE FROM shipments;");
      await runQuery("DELETE FROM truck_arrivals;");
      await runQuery("DELETE FROM station_incidents;");
      await runQuery("DELETE FROM charger_faults;");
      await runQuery("DELETE FROM driver_telemetry;");

      // Clear swap_queue if it exists
      try {
        await runQuery("DELETE FROM swap_queue;");
      } catch {
        // Table might not exist
      }

      // Clear truck battery references so bootstrap can assign fresh ones
      await runQuery("UPDATE trucks SET batteryId = '0', currentSoc = 50;");

      // Run one simulation cycle immediately so bootstrap creates fresh data
      await runSimulationCycle();

      res.status(200).json({
        status: "ok",
        message:
          "Simulation data reset. Bootstrap ran and created fresh batteries, swaps, and revenue data.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default simulationRouter;
