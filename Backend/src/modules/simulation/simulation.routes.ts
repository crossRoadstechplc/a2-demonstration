import { Router } from "express";

import {
  isSimulationRunning,
  startSimulation,
  stopSimulation
} from "../../services/simulationRunner";

const simulationRouter = Router();

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

export default simulationRouter;
