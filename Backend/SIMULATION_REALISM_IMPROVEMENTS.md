# Simulation Realism Improvements

**Date:** 2024  
**Purpose:** Comprehensive improvements to physical realism of the A2 Corridor simulation

---

## Overview

This document summarizes all improvements made to enhance the physical realism of the A2 Corridor simulation while maintaining stability and determinism for dashboard displays.

---

## 1. Battery Realism

### Improvements Made

1. **Standardized Capacity (588 kWh)**
   - All batteries now use 588 kWh capacity consistently
   - `battery-health-phase.ts` ensures capacity is standardized on every cycle
   - Bootstrap phase creates batteries with 588 kWh capacity

2. **Health Degradation**
   - Health degrades slowly: 0.01% per 10 cycles (0.001% per cycle)
   - Minimum health threshold: 50%
   - Health updates are efficient (only when cycle count is a multiple of 10)

3. **Cycle Count Tracking**
   - Cycle count increments when battery is swapped out (handled in `station-operations-phase`)
   - Cycle count is used for health degradation calculations

4. **Temperature Management**
   - **Charging batteries:** Temperature increases by 0.5-1.5°C per cycle (more at higher SOC), max 35°C
   - **Idle batteries:** Temperature decreases by 0.2-0.7°C per cycle (slower in trucks), min 20°C
   - Realistic thermal behavior during charging and idle states

5. **Status Transitions**
   - **READY → CHARGING:** When SOC < 95% and battery is at station
   - **CHARGING → READY:** When SOC >= 95%
   - **IN_TRUCK → CHARGING:** When battery is swapped out
   - **READY/CHARGING → MAINTENANCE:** When health < 60% or cycleCount > 1000
   - **MAINTENANCE → READY:** When health >= 60% and cycleCount <= 1000

### Files Modified
- `src/services/simulation/phases/battery-health-phase.ts`
- `src/services/simulation/phases/bootstrap-phase.ts`

---

## 2. Truck Realism

### Improvements Made

1. **Continuous Location Updates**
   - Truck locations (`locationLat`, `locationLng`) update continuously during transit
   - Location interpolation between stations using haversine distance
   - Progress tracking ensures smooth movement

2. **Station Arrival/Departure**
   - `currentStationId` is set when truck arrives at station
   - `currentStationId` is cleared (`NULL`) when truck departs
   - Status transitions: `READY` → `IN_TRANSIT` → `READY`

3. **Realistic SOC Drain**
   - Base consumption: ~2 kWh per km
   - Refrigerated trucks: Additional energy consumption based on `refrigerationPowerDraw`
   - SOC drop calculated from actual distance traveled and energy consumed
   - Formula: `socDrop = (totalEnergyKwh / 588) * 100`

4. **Refrigerated Truck Energy Consumption**
   - Extra energy = `(distanceKm * refrigerationPowerDraw) / 100` kWh
   - Results in higher energy consumption and lower SOC
   - Higher receipts for refrigerated trucks (already implemented)

5. **Maintenance Edge Cases**
   - 0.5% chance per cycle that truck enters maintenance
   - 20% chance per cycle to restore from maintenance
   - Status: `MAINTENANCE` with `availability = 'UNAVAILABLE'`

### Files Modified
- `src/services/simulation/phases/movement-phase.ts`

---

## 3. Queue Realism

### Improvements Made

1. **Queue Record Creation**
   - Queue entries created when trucks need swaps (SOC < 50) and are in transit
   - Station-specific: Each truck is queued at its nearest station
   - Status: `PENDING` → `ARRIVED` → `COMPLETED`

2. **Deterministic Ordering**
   - Queue ordered by distance (ascending), then by `bookedAt` (ascending)
   - Ensures fair first-come-first-served within distance groups
   - Distance updated as trucks move closer to station

3. **ETA and Distance Tracking**
   - Distance calculated using haversine formula
   - ETA calculated assuming 60 km/h average speed
   - `estimatedArrival` timestamp updated as truck moves

4. **KPI Impact**
   - Queue size drives station congestion alerts
   - Queue size > 5 triggers `QUEUE_CONGESTION` incident
   - Queue size displayed on station dashboards

### Files Modified
- `src/services/simulation/phases/queue-management-phase.ts`
- `src/services/simulation/phases/incidents-faults-phase.ts`

---

## 4. Charging Realism

### Improvements Made

1. **Charging Window Respect**
   - Default window: 22:00-06:00 (configurable)
   - Charging only occurs during window (or at reduced rate for demo)
   - Window check uses hour-based logic

2. **Active Charging Sessions**
   - Sessions created when battery needs charging (SOC < 95%)
   - Tracks: `startSoc`, `currentSoc`, `targetSoc` (95%), `energyAddedKwh`
   - Status: `ACTIVE` → `COMPLETED`

3. **Realistic Charging Rates**
   - Charger output: 50 kW
   - Charger efficiency: 95%
   - Energy added per cycle: `50 kW * (10s / 3600s) * 0.95 = ~0.132 kWh`
   - SOC increase calculated from energy added

4. **Energy Added Tracking**
   - Energy added computed from SOC progression
   - Formula: `energyAddedKwh = (capacityKwh * (currentSoc - startSoc)) / 100`
   - Tracked in `charging_sessions.energyAddedKwh`

5. **Station Charger Capacity Constraints**
   - Charger capacity: ~1 charger per 3.5 batteries
   - Minimum: 10 chargers per station
   - Maximum: 50 chargers per station
   - Active sessions limited by available charger slots

### Files Modified
- `src/services/simulation/phases/charging-phase.ts`

---

## 5. Incoming Truck Predictions

### Improvements Made

1. **ETA Calculation**
   - Distance calculated using haversine formula
   - ETA = `(distanceKm / 60) * 60` minutes (assuming 60 km/h)
   - Displayed as `~X min` or "Arriving"

2. **Distance Calculation**
   - Real-time distance from truck location to station
   - Updated as trucks move
   - Displayed in kilometers (1 decimal place)

3. **Estimated SOC**
   - Realistic SOC estimation based on distance
   - Formula: `estimatedSoc = currentSoc - ((distanceKm * 2.0) / 588) * 100`
   - Accounts for base energy consumption (~2 kWh/km)
   - Uses standard 588 kWh battery capacity

### Files Modified
- `src/modules/dashboard/dashboard.routes.ts`

---

## 6. EEU Realism

### Improvements Made

1. **Live Network Load**
   - Total load = `activeChargers * 50 kW`
   - Real-time calculation from active charging sessions
   - Updated every simulation cycle

2. **Station Loads**
   - Per-station load = `activeChargersAtStation * 50 kW`
   - Grouped by station for detailed analysis
   - Exposed via `/dashboard/eeu` endpoint

3. **Active Charger Counts**
   - Count of active charging sessions per station
   - Used for load calculations and capacity planning
   - Displayed on EEU dashboard

4. **Peak Load Station**
   - Identifies station with highest current load
   - Useful for grid management and capacity planning
   - Updated in real-time

5. **24-Hour Forecast**
   - Simple forecast model based on current state and historical patterns
   - Uses time-of-day patterns (higher load during charging window)
   - Forecasts load (kW) and energy (kWh) for next 24 hours
   - Each hour includes: `hour`, `forecastLoadKw`, `forecastEnergyKwh`

### Files Modified
- `src/services/scoped-queries.ts` (EEU queries)
- `src/modules/dashboard/dashboard.routes.ts` (EEU endpoint)

---

## 7. Incidents and Faults

### Improvements Made

1. **Queue Congestion Detection**
   - Threshold: Queue size > 5 trucks
   - Severity: `LOW` (5-7), `MEDIUM` (7-10), `HIGH` (>10)
   - Auto-resolves when queue clears
   - Message includes actual queue size

2. **Charger Fault Generation**
   - 1-2% chance per active charger per cycle
   - Error codes: E114, E201, E305, E402, E503
   - Descriptions: Communication timeout, overcurrent, temperature sensor, ground fault, power supply failure
   - Status: `OPEN` → `RESOLVED`

3. **Auto-Resolution**
   - 10-20% chance per cycle to auto-resolve open faults
   - Applies to both charger faults and incidents
   - Realistic maintenance response times

4. **Battery Shortage Detection**
   - Threshold: Ready batteries < 10% of station capacity
   - Severity: `HIGH`
   - Auto-resolves when batteries are replenished

### Files Modified
- `src/services/simulation/phases/incidents-faults-phase.ts`

---

## 8. Live Feed Realism

### Improvements Made

1. **Event Types Recorded**
   - **Swap completed:** Recorded in `swap_transactions` table
   - **Charging started:** Recorded in `charging_sessions` table
   - **Charging completed:** Recorded in `charging_sessions` table
   - **Shipment assigned:** Recorded in `shipments` table
   - **Shipment delivered:** Recorded in `shipments` table
   - **Incident raised:** Recorded in `station_incidents` table
   - **Charger fault raised:** Recorded in `charger_faults` table
   - **Driver assigned:** Recorded in `drivers.assignedTruckId`
   - **Truck arrived:** Recorded in `truck_arrivals` table

2. **Event Storage**
   - Events stored in appropriate tables
   - Timestamps for all events
   - Dashboard endpoints query these tables for live feed

### Files Modified
- `src/services/simulation/phases/live-feed-phase.ts`

---

## Test Coverage

### Comprehensive Test Suite

Created `tests/simulation-realism.test.ts` with tests for:

1. **Battery Realism Tests**
   - 588 kWh capacity consistency
   - Health degradation over time
   - Cycle count increment on swap
   - Temperature changes during charging
   - Status transitions

2. **Truck Realism Tests**
   - Continuous location updates
   - Station arrival/departure
   - Refrigerated truck energy consumption
   - Maintenance edge cases

3. **Queue Realism Tests**
   - Queue record creation
   - Station-specific queues
   - Deterministic ordering

4. **Charging Realism Tests**
   - Charging window respect
   - SOC and target SOC tracking
   - Energy added computation
   - Charger capacity constraints

5. **Incoming Truck Predictions Tests**
   - ETA, distance, and estimated SOC generation

6. **EEU Realism Tests**
   - Live network load
   - Station loads
   - Peak load station
   - 24-hour forecast

7. **Incidents and Faults Tests**
   - Queue congestion events
   - Charger fault generation

8. **Live Feed Realism Tests**
   - Swap completed events
   - Charging events
   - Incident and fault events

---

## Key Constants

### Battery Constants
- **Standard Capacity:** 588 kWh
- **Health Degradation:** 0.01% per 10 cycles
- **Min Health:** 50%
- **Max Temperature:** 35°C
- **Min Temperature:** 20°C

### Charging Constants
- **Charger Output:** 50 kW
- **Charger Efficiency:** 95%
- **Target SOC:** 95%
- **Chargers per Battery:** ~1 per 3.5 batteries
- **Min Chargers per Station:** 10
- **Max Chargers per Station:** 50

### Truck Constants
- **Base Energy Consumption:** 2 kWh/km
- **Average Speed:** 60 km/h
- **Maintenance Probability:** 0.5% per cycle
- **Maintenance Recovery:** 20% per cycle

### Queue Constants
- **Congestion Threshold:** 5 trucks
- **Severity Levels:**
  - LOW: 5-7 trucks
  - MEDIUM: 7-10 trucks
  - HIGH: >10 trucks

### Charger Fault Constants
- **Fault Probability:** 1-2% per active charger per cycle
- **Auto-Resolution Probability:** 10-20% per cycle

---

## Performance Considerations

1. **Efficient Updates**
   - Health degradation only updates every 10 cycles
   - Temperature updates are incremental
   - Queue distance updates only when truck moves significantly

2. **Database Queries**
   - Batch operations where possible
   - Indexed queries for performance
   - Minimal redundant calculations

3. **Deterministic Behavior**
   - All calculations are deterministic
   - No random behavior that affects core simulation
   - Predictable outcomes for testing

---

## End of Documentation

This document provides a complete overview of all simulation realism improvements made to the A2 Corridor system.
