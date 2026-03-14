"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const simulationRunner_1 = require("../../services/simulationRunner");
const simulationRouter = (0, express_1.Router)();
simulationRouter.post("/simulation/start", (_req, res) => {
    const started = (0, simulationRunner_1.startSimulation)();
    res.status(200).json({
        running: (0, simulationRunner_1.isSimulationRunning)(),
        message: started ? "Simulation started" : "Simulation already running"
    });
});
simulationRouter.post("/simulation/stop", (_req, res) => {
    const stopped = (0, simulationRunner_1.stopSimulation)();
    res.status(200).json({
        running: (0, simulationRunner_1.isSimulationRunning)(),
        message: stopped ? "Simulation stopped" : "Simulation already stopped"
    });
});
exports.default = simulationRouter;
