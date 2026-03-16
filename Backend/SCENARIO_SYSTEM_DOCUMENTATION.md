# Scenario-Based Demo Controls

**Date:** 2024  
**Purpose:** Allow demo operators to trigger meaningful system states on demand without breaking synchronization

---

## Overview

The scenario system enables controlled demonstration of different operating conditions in the A2 Corridor simulation. Each scenario applies specific modifiers to simulation behavior while maintaining data consistency and dashboard synchronization.

---

## Available Scenarios

### 1. normal-operations
**Description:** Baseline normal operations (default state)

**Modifiers:** None (all multipliers = 1.0)

**Use Case:** Reset to baseline or demonstrate normal operations

---

### 2. morning-peak
**Description:** Morning peak traffic and demand

**Modifiers:**
- `truckMovementMultiplier`: 1.2 (20% more trucks moving)
- `swapFrequencyMultiplier`: 1.3 (30% more swaps)
- `queueBuildUpMultiplier`: 1.2 (slight queue buildup)
- `shipmentGenerationMultiplier`: 1.2 (20% more shipments)

**Use Case:** Demonstrate peak hour operations, increased activity

---

### 3. station-congestion
**Description:** Station congestion with queue buildup

**Modifiers:**
- `queueBuildUpMultiplier`: 2.5 (significant queue buildup)
- `readyBatteryAvailabilityMultiplier`: 0.5 (50% fewer ready batteries)
- `queueThreshold`: 3 (lower threshold for alerts)
- `incidentGenerationMultiplier`: 2.0 (more incidents)
- `targetStationIds`: Optional - specific stations to target

**Use Case:** Demonstrate congestion management, queue handling, incident response

**Parameters:**
```json
{
  "parameters": {
    "targetStationIds": [1, 2]  // Optional: specific station IDs
  }
}
```

---

### 4. charger-fault
**Description:** Charger faults at selected stations

**Modifiers:**
- `chargerFaultMultiplier`: 10.0 (10x higher fault probability)
- `chargerAvailabilityMultiplier`: 0.7 (30% fewer available chargers)
- `chargingRateMultiplier`: 0.8 (20% slower charging)
- `targetStationIds`: Optional - specific stations to target

**Use Case:** Demonstrate fault handling, reduced charging capacity, maintenance response

**Parameters:**
```json
{
  "parameters": {
    "targetStationIds": [1]  // Optional: specific station IDs
  }
}
```

---

### 5. refrigerated-priority
**Description:** Increased refrigerated truck activity

**Modifiers:**
- `refrigeratedShipmentMultiplier`: 2.0 (2x more refrigerated shipments)
- `socDrainMultiplier`: 1.3 (30% higher SOC drain)
- `networkLoadMultiplier`: 1.2 (20% higher network load)
- `swapFrequencyMultiplier`: 1.2 (20% more swaps)

**Use Case:** Demonstrate refrigerated truck operations, higher energy demand, increased swap frequency

---

### 6. high-revenue-day
**Description:** High revenue day with increased activity

**Modifiers:**
- `swapFrequencyMultiplier`: 1.5 (50% more swaps)
- `shipmentGenerationMultiplier`: 1.4 (40% more shipments)
- `freightCompletionMultiplier`: 1.3 (30% faster freight completion)
- `truckMovementMultiplier`: 1.1 (10% more active trucks)

**Use Case:** Demonstrate peak revenue operations, high activity levels

---

### 7. low-battery-stress
**Description:** Low battery availability stress test

**Modifiers:**
- `readyBatteryAvailabilityMultiplier`: 0.3 (70% fewer ready batteries)
- `chargingRateMultiplier`: 0.9 (10% slower charging)
- `queueBuildUpMultiplier`: 1.5 (queue buildup due to shortage)
- `incidentGenerationMultiplier`: 1.5 (more battery shortage incidents)

**Use Case:** Demonstrate battery shortage handling, queue management under stress

---

### 8. grid-constraint-warning
**Description:** Grid constraint warning with high load

**Modifiers:**
- `networkLoadMultiplier`: 1.5 (50% higher network load)
- `chargingRateMultiplier`: 0.85 (15% reduced charging rate)
- `gridNoticeProbability`: 0.3 (30% chance of grid notice per cycle)
- `chargerAvailabilityMultiplier`: 0.9 (10% reduced charger availability)

**Use Case:** Demonstrate grid constraint handling, EEU coordination, load management

---

## API Endpoints

### POST `/demo/scenario/:name`
Activate a scenario.

**Authentication:** Required (ADMIN or A2_OPERATOR)

**Parameters:**
- `:name` - Scenario name (path parameter)
- `parameters` - Optional scenario-specific parameters (body)

**Example:**
```bash
POST /demo/scenario/station-congestion
Authorization: Bearer <token>
Content-Type: application/json

{
  "parameters": {
    "targetStationIds": [1, 2]
  }
}
```

**Response:**
```json
{
  "message": "Scenario 'station-congestion' activated",
  "scenario": {
    "name": "station-congestion",
    "isActive": true,
    "activatedAt": "2024-01-01T12:00:00.000Z",
    "parameters": {
      "targetStationIds": [1, 2]
    }
  }
}
```

---

### GET `/demo/scenario`
Get current active scenario.

**Authentication:** Required (ADMIN or A2_OPERATOR)

**Response:**
```json
{
  "activeScenario": {
    "name": "morning-peak",
    "isActive": true,
    "activatedAt": "2024-01-01T12:00:00.000Z",
    "parameters": {}
  },
  "availableScenarios": [
    {
      "name": "normal-operations",
      "description": "Normal operations (baseline)"
    },
    {
      "name": "morning-peak",
      "description": "Morning peak traffic and demand"
    },
    // ... other scenarios
  ]
}
```

---

### POST `/demo/scenario/reset`
Reset to normal operations.

**Authentication:** Required (ADMIN or A2_OPERATOR)

**Response:**
```json
{
  "message": "Scenario reset to normal operations",
  "scenario": {
    "name": null,
    "isActive": false,
    "activatedAt": null,
    "parameters": {}
  }
}
```

---

## Scenario Modifiers

Scenarios modify simulation behavior through multipliers and thresholds:

### Movement Phase Modifiers
- `truckMovementMultiplier`: Multiplies truck movement speed
- `socDrainMultiplier`: Multiplies SOC drain rate

### Station Operations Modifiers
- `swapFrequencyMultiplier`: Multiplies swap probability
- `readyBatteryAvailabilityMultiplier`: Multiplies ready battery availability (0.0-1.0)

### Charging Phase Modifiers
- `chargingRateMultiplier`: Multiplies charging rate
- `chargerAvailabilityMultiplier`: Multiplies available charger count

### Queue Management Modifiers
- `queueBuildUpMultiplier`: Multiplies queue buildup rate
- `queueThreshold`: Override queue congestion threshold

### Freight Phase Modifiers
- `shipmentGenerationMultiplier`: Multiplies shipment generation rate
- `refrigeratedShipmentMultiplier`: Multiplies refrigerated shipment ratio
- `freightCompletionMultiplier`: Multiplies freight completion rate

### Incidents and Faults Modifiers
- `incidentGenerationMultiplier`: Multiplies incident generation probability
- `chargerFaultMultiplier`: Multiplies charger fault probability
- `gridNoticeProbability`: Probability of grid notice generation (0.0-1.0)

### EEU Modifiers
- `networkLoadMultiplier`: Multiplies network load calculation

### Targeting Modifiers
- `targetStationIds`: Array of station IDs to target (optional)

---

## Integration with Simulation Phases

Scenarios are integrated into all simulation phases:

1. **Movement Phase**: Applies `truckMovementMultiplier` and `socDrainMultiplier`
2. **Station Operations Phase**: Applies `swapFrequencyMultiplier` and `readyBatteryAvailabilityMultiplier`
3. **Charging Phase**: Applies `chargingRateMultiplier` and `chargerAvailabilityMultiplier`
4. **Queue Management Phase**: Applies `queueBuildUpMultiplier` and `queueThreshold`
5. **Freight Phase**: Applies shipment and completion multipliers
6. **Incidents and Faults Phase**: Applies incident and fault multipliers, grid notices

---

## Data Consistency

Scenarios maintain data consistency:

- All modifiers are applied consistently across phases
- Dashboard values continue to reconcile correctly
- Financial calculations remain accurate
- No duplicate counters or data drift
- All simulation records are valid

---

## Testing

Comprehensive test coverage in `tests/scenario-activation.test.ts`:

- API endpoint tests (GET, POST, reset)
- Scenario activation tests
- Modifier verification tests
- Integration tests with simulation cycles
- Reset functionality tests

---

## Usage Examples

### Example 1: Demonstrate Station Congestion
```bash
# Activate congestion scenario at station 1
POST /demo/scenario/station-congestion
{
  "parameters": {
    "targetStationIds": [1]
  }
}

# Run simulation - observe:
# - Increased queue at station 1
# - Reduced ready batteries
# - More incidents
# - Lower queue threshold alerts
```

### Example 2: Demonstrate Charger Faults
```bash
# Activate charger fault scenario
POST /demo/scenario/charger-fault
{
  "parameters": {
    "targetStationIds": [2, 3]
  }
}

# Run simulation - observe:
# - Charger faults at stations 2 and 3
# - Reduced charging capacity
# - Slower charging rates
```

### Example 3: Demonstrate High Revenue Day
```bash
# Activate high revenue scenario
POST /demo/scenario/high-revenue-day

# Run simulation - observe:
# - More swaps
# - More shipments
# - Faster freight completion
# - Higher revenue totals
```

### Example 4: Reset to Normal
```bash
# Reset scenario
POST /demo/scenario/reset

# All modifiers return to baseline (1.0 or defaults)
```

---

## Implementation Details

### Database Schema
```sql
CREATE TABLE demo_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenarioName TEXT NOT NULL UNIQUE,
  isActive INTEGER NOT NULL DEFAULT 0,
  activatedAt TEXT,
  parameters TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Service Architecture
- `scenario-service.ts`: Manages scenario state and modifiers
- `demo.routes.ts`: API endpoints for scenario management
- Simulation phases: Check for active scenario and apply modifiers

### State Management
- Only one scenario can be active at a time
- Activating a new scenario deactivates the previous one
- Scenario state persists across simulation cycles
- Reset clears all scenario state

---

## Best Practices

1. **Use Targeted Scenarios**: When possible, use `targetStationIds` to focus effects on specific stations
2. **Monitor Dashboard Values**: Verify that dashboard KPIs reflect scenario changes correctly
3. **Reset Between Demos**: Always reset to normal operations between different scenario demonstrations
4. **Test Scenarios**: Run simulation cycles after activating scenarios to see effects
5. **Document Custom Parameters**: If using custom parameters, document them for reproducibility

---

## End of Documentation

This document provides a complete overview of the scenario-based demo control system for the A2 Corridor simulation.
