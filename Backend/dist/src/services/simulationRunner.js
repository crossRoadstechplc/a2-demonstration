"use strict";
/**
 * Simulation Runner
 *
 * Top-level simulation controller that manages start/stop and delegates
 * to the modular simulation orchestrator.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSimulationCycle = void 0;
exports.isSimulationRunning = isSimulationRunning;
exports.startSimulation = startSimulation;
exports.stopSimulation = stopSimulation;
const orchestrator_1 = require("./simulation/orchestrator");
const SIMULATION_INTERVAL_MS = 10000;
let simulationTimer = null;
/**
 * Re-export the orchestrator's runSimulationCycle for backward compatibility
 */
var orchestrator_2 = require("./simulation/orchestrator");
Object.defineProperty(exports, "runSimulationCycle", { enumerable: true, get: function () { return orchestrator_2.runSimulationCycle; } });
// Re-export for internal use
const runSimulationCycle = orchestrator_1.runSimulationCycle;
function isSimulationRunning() {
    return simulationTimer !== null;
}
function startSimulation() {
    if (simulationTimer) {
        return false;
    }
    void runSimulationCycle().catch((error) => {
        const message = error instanceof Error ? error.message : "Initial simulation cycle failed";
        console.error(message);
    });
    simulationTimer = setInterval(() => {
        void runSimulationCycle().catch((error) => {
            const message = error instanceof Error ? error.message : "Simulation cycle failed";
            console.error(message);
        });
    }, SIMULATION_INTERVAL_MS);
    return true;
}
function stopSimulation() {
    if (!simulationTimer) {
        return false;
    }
    clearInterval(simulationTimer);
    simulationTimer = null;
    return true;
}
