/**
 * Scenario Service
 * 
 * Manages demo scenario state and provides scenario-specific modifiers
 * for simulation phases.
 */

import { allQuery, getQuery, runQuery } from "../../database/connection";

export type ScenarioName =
  | "normal-operations"
  | "morning-peak"
  | "station-congestion"
  | "charger-fault"
  | "refrigerated-priority"
  | "high-revenue-day"
  | "low-battery-stress"
  | "grid-constraint-warning";

export interface ScenarioState {
  scenarioName: ScenarioName | null;
  isActive: boolean;
  activatedAt: string | null;
  parameters: Record<string, unknown>;
}

export interface ScenarioModifiers {
  // Movement phase modifiers
  truckMovementMultiplier?: number; // Multiplier for truck movement speed
  socDrainMultiplier?: number; // Multiplier for SOC drain rate

  // Station operations modifiers
  swapFrequencyMultiplier?: number; // Multiplier for swap frequency
  readyBatteryAvailabilityMultiplier?: number; // Multiplier for ready battery availability

  // Charging phase modifiers
  chargingRateMultiplier?: number; // Multiplier for charging rate
  chargerAvailabilityMultiplier?: number; // Multiplier for available chargers

  // Queue management modifiers
  queueBuildUpMultiplier?: number; // Multiplier for queue buildup rate
  queueThreshold?: number; // Override queue congestion threshold

  // Freight phase modifiers
  shipmentGenerationMultiplier?: number; // Multiplier for shipment generation
  refrigeratedShipmentMultiplier?: number; // Multiplier for refrigerated shipments
  freightCompletionMultiplier?: number; // Multiplier for freight completion rate

  // Incidents and faults modifiers
  incidentGenerationMultiplier?: number; // Multiplier for incident generation
  chargerFaultMultiplier?: number; // Multiplier for charger fault probability

  // EEU modifiers
  networkLoadMultiplier?: number; // Multiplier for network load
  gridNoticeProbability?: number; // Probability of grid notice generation

  // Station selection (for targeted scenarios)
  targetStationIds?: number[]; // Specific stations to target
}

class ScenarioService {
  private currentScenario: ScenarioState | null = null;

  /**
   * Get current active scenario
   */
  async getActiveScenario(): Promise<ScenarioState> {
    const row = await getQuery<{
      scenarioName: string;
      isActive: number;
      activatedAt: string | null;
      parameters: string | null;
    }>("SELECT scenarioName, isActive, activatedAt, parameters FROM demo_scenarios WHERE isActive = 1 LIMIT 1;");

    if (!row || !row.isActive) {
      return {
        scenarioName: null,
        isActive: false,
        activatedAt: null,
        parameters: {},
      };
    }

    return {
      scenarioName: row.scenarioName as ScenarioName,
      isActive: true,
      activatedAt: row.activatedAt,
      parameters: row.parameters ? JSON.parse(row.parameters) : {},
    };
  }

  /**
   * Activate a scenario
   */
  async activateScenario(scenarioName: ScenarioName, parameters?: Record<string, unknown>): Promise<void> {
    // Deactivate all scenarios first
    await runQuery("UPDATE demo_scenarios SET isActive = 0;");

    // Check if scenario exists
    const existing = await getQuery<{ id: number }>(
      "SELECT id FROM demo_scenarios WHERE scenarioName = ?;",
      [scenarioName]
    );

    const timestamp = new Date().toISOString();
    const paramsJson = JSON.stringify(parameters || {});

    if (existing) {
      // Update existing scenario
      await runQuery(
        "UPDATE demo_scenarios SET isActive = 1, activatedAt = ?, parameters = ? WHERE scenarioName = ?;",
        [timestamp, paramsJson, scenarioName]
      );
    } else {
      // Insert new scenario
      await runQuery(
        "INSERT INTO demo_scenarios (scenarioName, isActive, activatedAt, parameters) VALUES (?, 1, ?, ?);",
        [scenarioName, timestamp, paramsJson]
      );
    }

    // Refresh cache
    this.currentScenario = await this.getActiveScenario();
  }

  /**
   * Reset to normal operations
   */
  async resetScenario(): Promise<void> {
    await runQuery("UPDATE demo_scenarios SET isActive = 0;");
    this.currentScenario = {
      scenarioName: null,
      isActive: false,
      activatedAt: null,
      parameters: {},
    };
  }

  /**
   * Get scenario modifiers for current active scenario
   */
  async getModifiers(): Promise<ScenarioModifiers> {
    const scenario = await this.getActiveScenario();

    if (!scenario.isActive || !scenario.scenarioName) {
      return {}; // No modifiers for normal operations
    }

    return this.getModifiersForScenario(scenario.scenarioName, scenario.parameters);
  }

  /**
   * Get modifiers for a specific scenario
   */
  private getModifiersForScenario(
    scenarioName: ScenarioName,
    parameters: Record<string, unknown>
  ): ScenarioModifiers {
    switch (scenarioName) {
      case "normal-operations":
        return {}; // No modifiers

      case "morning-peak":
        return {
          truckMovementMultiplier: 1.2, // More trucks moving
          swapFrequencyMultiplier: 1.3, // Higher swap frequency
          queueBuildUpMultiplier: 1.2, // Slight queue buildup
          shipmentGenerationMultiplier: 1.2, // More shipments
        };

      case "station-congestion":
        return {
          queueBuildUpMultiplier: 2.5, // Significant queue buildup
          readyBatteryAvailabilityMultiplier: 0.5, // Reduce ready batteries
          queueThreshold: 3, // Lower threshold for alerts
          incidentGenerationMultiplier: 2.0, // More incidents
          targetStationIds: parameters.targetStationIds as number[] | undefined,
        };

      case "charger-fault":
        return {
          chargerFaultMultiplier: 10.0, // Much higher fault probability
          chargerAvailabilityMultiplier: 0.7, // Reduce available chargers
          chargingRateMultiplier: 0.8, // Slower charging due to faults
          targetStationIds: parameters.targetStationIds as number[] | undefined,
        };

      case "refrigerated-priority":
        return {
          refrigeratedShipmentMultiplier: 2.0, // More refrigerated shipments
          socDrainMultiplier: 1.3, // Higher SOC drain (more refrigerated trucks active)
          networkLoadMultiplier: 1.2, // Higher network load
          swapFrequencyMultiplier: 1.2, // More swaps due to higher energy consumption
        };

      case "high-revenue-day":
        return {
          swapFrequencyMultiplier: 1.5, // More swaps
          shipmentGenerationMultiplier: 1.4, // More shipments
          freightCompletionMultiplier: 1.3, // Faster freight completion
          truckMovementMultiplier: 1.1, // More active trucks
        };

      case "low-battery-stress":
        return {
          readyBatteryAvailabilityMultiplier: 0.3, // Very few ready batteries
          chargingRateMultiplier: 0.9, // Slightly slower charging
          queueBuildUpMultiplier: 1.5, // Queue buildup due to battery shortage
          incidentGenerationMultiplier: 1.5, // More battery shortage incidents
        };

      case "grid-constraint-warning":
        return {
          networkLoadMultiplier: 1.5, // Higher network load
          chargingRateMultiplier: 0.85, // Reduced charging rate
          gridNoticeProbability: 0.3, // 30% chance of grid notice per cycle
          chargerAvailabilityMultiplier: 0.9, // Slightly reduced charger availability
        };

      default:
        return {};
    }
  }

  /**
   * Check if a specific scenario is active
   */
  async isScenarioActive(scenarioName: ScenarioName): Promise<boolean> {
    const scenario = await this.getActiveScenario();
    return scenario.isActive && scenario.scenarioName === scenarioName;
  }

  /**
   * Get all available scenarios
   */
  getAllScenarios(): Array<{ name: ScenarioName; description: string }> {
    return [
      { name: "normal-operations", description: "Normal operations (baseline)" },
      { name: "morning-peak", description: "Morning peak traffic and demand" },
      { name: "station-congestion", description: "Station congestion with queue buildup" },
      { name: "charger-fault", description: "Charger faults at selected stations" },
      { name: "refrigerated-priority", description: "Increased refrigerated truck activity" },
      { name: "high-revenue-day", description: "High revenue day with increased activity" },
      { name: "low-battery-stress", description: "Low battery availability stress test" },
      { name: "grid-constraint-warning", description: "Grid constraint warning with high load" },
    ];
  }
}

// Singleton instance
export const scenarioService = new ScenarioService();
