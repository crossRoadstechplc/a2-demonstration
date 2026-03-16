/**
 * Simulation Runner
 * 
 * Top-level simulation controller that manages start/stop and delegates
 * to the modular simulation orchestrator.
 */

import { runSimulationCycle as runOrchestratorCycle } from "./simulation/orchestrator";

const SIMULATION_INTERVAL_MS = 10_000;

let simulationTimer: NodeJS.Timeout | null = null;

/**
 * Re-export the orchestrator's runSimulationCycle for backward compatibility
 */
export { runSimulationCycle } from "./simulation/orchestrator";

// Re-export for internal use
const runSimulationCycle = runOrchestratorCycle;

export function isSimulationRunning(): boolean {
  return simulationTimer !== null;
}

export function startSimulation(): boolean {
  if (simulationTimer) {
    return false;
  }

  void runSimulationCycle().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Initial simulation cycle failed";
    console.error(message);
  });

  simulationTimer = setInterval(() => {
    void runSimulationCycle().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Simulation cycle failed";
      console.error(message);
    });
  }, SIMULATION_INTERVAL_MS);

  return true;
}

export function stopSimulation(): boolean {
  if (!simulationTimer) {
    return false;
  }

  clearInterval(simulationTimer);
  simulationTimer = null;
  return true;
}
