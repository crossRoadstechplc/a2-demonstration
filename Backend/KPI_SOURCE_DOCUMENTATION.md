# KPI Source Documentation

This document maps every dashboard KPI to its exact source in the simulation and database.

---

## A2 HQ Dashboard KPIs

### Overview Tab

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Active Trucks** | `trucks` | `COUNT(*) WHERE status IN ('READY', 'IN_TRANSIT')` | Movement Phase |
| **Swaps Today** | `swap_transactions` | `COUNT(*) WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Station Operations Phase |
| **Batteries Ready** | `batteries` | `COUNT(*) WHERE status = 'READY'` | Charging Phase |
| **Charging Active** | `charging_sessions` | `COUNT(*) WHERE status = 'ACTIVE'` | Charging Phase |
| **Corridor Energy Today** | `swap_transactions` | `SUM(energyDeliveredKwh) WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Station Operations Phase |
| **Corridor Revenue** | `receipts` + `swap_transactions` | `SUM(r.total) WHERE date(st.timestamp, 'localtime') = date('now', 'localtime')` | Finance Phase |
| **A2 Share** | `receipts` | `SUM(a2Share) WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Finance Phase |
| **EEU Share** | `receipts` | `SUM(eeuShare) WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Finance Phase |
| **VAT Collected** | `receipts` | `SUM(vat) WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Finance Phase |
| **Stations Online** | `stations` | `COUNT(*) WHERE status = 'ACTIVE'` | Static (seed data) |

### Live Feed Components

| Component | Source Table/Query | Calculation | Phase Responsible |
|-----------|-------------------|-------------|-------------------|
| **Live Swap Feed** | `swap_transactions` | `SELECT * ORDER BY timestamp DESC LIMIT 10` | Station Operations Phase |
| **Driver/Truck Assignments** | `drivers` + `trucks` | `JOIN WHERE d.assignedTruckId = t.id AND t.assignedDriverId = d.id` | Driver Telemetry Phase |
| **Queue/Congestion Alerts** | `station_incidents` | `WHERE type = 'QUEUE_CONGESTION' AND status = 'OPEN'` | Incidents/Faults Phase |
| **Operational Incidents** | `station_incidents` | `WHERE status = 'OPEN' ORDER BY reportedAt DESC` | Incidents/Faults Phase |
| **Power Consumption by Station** | `swap_transactions` + `receipts` | `GROUP BY stationId, SUM(energyDeliveredKwh), SUM(total)` | Station Operations + Finance Phases |
| **Revenue Summary** | `receipts` | Aggregated totals from receipts | Finance Phase |

### Batteries Tab

| Column | Source Table | Field | Phase Responsible |
|--------|--------------|-------|-------------------|
| Battery ID | `batteries` | `id` | Bootstrap Phase |
| Status | `batteries` | `status` | Charging Phase, Station Operations Phase |
| SOC | `batteries` | `soc` | Charging Phase, Movement Phase |
| Health | `batteries` | `health` | Battery Health Phase |
| Cycle Count | `batteries` | `cycleCount` | Battery Health Phase |
| Location Type | `batteries` | `stationId IS NOT NULL ? 'Station' : 'Truck'` | Station Operations Phase |
| Location Name | `stations` or `trucks` | `name` or `plateNumber` | Station Operations Phase |
| Temperature | `batteries` | `temperature` | Battery Health Phase |
| Capacity | `batteries` | `capacityKwh` (588 kWh) | Bootstrap Phase |

### Freight Tab

| Column | Source Table | Field | Phase Responsible |
|--------|--------------|-------|-------------------|
| Shipment ID | `shipments` | `id` | Freight Phase |
| Customer ID | `shipments` | `customerId` | Freight Phase |
| Pickup Location | `shipments` | `pickupLocation` | Freight Phase |
| Delivery Location | `shipments` | `deliveryLocation` | Freight Phase |
| Status | `shipments` | `status` | Freight Phase |
| Assigned Truck | `trucks` | `plateNumber` | Freight Phase |
| Assigned Driver | `drivers` | `name` | Freight Phase |
| Refrigerated | `shipments` | `requiresRefrigeration` | Freight Phase |

### System Health Tab

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Stations Online** | `stations` | `COUNT(*) WHERE status = 'ACTIVE'` | Static |
| **Stations Offline** | `stations` | `COUNT(*) WHERE status = 'INACTIVE'` | Static |
| **Trucks Active** | `trucks` | `COUNT(*) WHERE status IN ('READY', 'IN_TRANSIT')` | Movement Phase |
| **Trucks Idle** | `trucks` | `COUNT(*) WHERE status = 'IDLE'` | Movement Phase |
| **Trucks Maintenance** | `trucks` | `COUNT(*) WHERE status = 'MAINTENANCE'` | Movement Phase |
| **Drivers Active** | `drivers` | `COUNT(*) WHERE status = 'ACTIVE'` | Driver Telemetry Phase |
| **Drivers Inactive** | `drivers` | `COUNT(*) WHERE status IN ('AVAILABLE', 'ON_DUTY', 'RESTING')` | Driver Telemetry Phase |
| **Network Utilization** | Calculated | `((activeTrucks/totalTrucks) + (activeStations/totalStations)) / 2 * 100` | Derived |
| **Average Swap Time** | `swap_transactions` + `truck_arrivals` | Average time between arrival and swap | Derived |
| **Average Charging Time** | `charging_sessions` | `AVG((julianday(endTime) - julianday(startTime)) * 24 * 60)` | Charging Phase |

---

## Fleet Dashboard KPIs

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Active Trucks** | `trucks` | `COUNT(*) WHERE fleetId = ? AND status IN ('READY', 'IN_TRANSIT')` | Movement Phase |
| **Available Trucks** | `trucks` | `COUNT(*) WHERE fleetId = ? AND availability = 'AVAILABLE'` | Movement Phase |
| **Active Drivers** | `drivers` | `COUNT(*) WHERE fleetId = ? AND status = 'ACTIVE'` | Driver Telemetry Phase |
| **Swaps Today** | `swap_transactions` + `trucks` | `COUNT(*) WHERE t.fleetId = ? AND date(st.timestamp) = date('now')` | Station Operations Phase |
| **Fleet Energy Cost** | `receipts` + `swap_transactions` + `trucks` | `SUM(r.total) WHERE t.fleetId = ? AND date(r.timestamp) = date('now')` | Finance Phase |
| **Completed Trips** | `shipments` + `trucks` | `COUNT(*) WHERE t.fleetId = ? AND s.status = 'DELIVERED'` | Freight Phase |
| **Maintenance Alerts** | `trucks` | `COUNT(*) WHERE fleetId = ? AND (status = 'MAINTENANCE' OR currentSoc < 20)` | Movement Phase |
| **Refrigerated Active** | `trucks` | `COUNT(*) WHERE fleetId = ? AND truckType = 'REFRIGERATED' AND status = 'IN_TRANSIT'` | Movement Phase |

### Trucks Tab

| Column | Source Table | Field | Phase Responsible |
|--------|--------------|-------|-------------------|
| License Plate | `trucks` | `plateNumber` | Static (seed) |
| Location | `trucks` + `stations` | `currentStationId ? station.name : coordinates` | Movement Phase |
| Battery ID | `trucks` | `batteryId` | Station Operations Phase |
| Driver | `drivers` | `name` | Driver Telemetry Phase |
| Status | `trucks` | `status` | Movement Phase |
| Type | `trucks` | `truckType` | Static |
| SOC | `trucks` | `currentSoc` | Movement Phase |
| Last Swap | `swap_transactions` + `stations` | Latest swap for truck | Station Operations Phase |
| Swaps Today | `swap_transactions` | `COUNT(*) WHERE truckId = ? AND date(timestamp) = date('now')` | Station Operations Phase |
| Energy Today | `swap_transactions` | `SUM(energyDeliveredKwh) WHERE truckId = ? AND date(timestamp) = date('now')` | Station Operations Phase |

### Drivers Tab

| Column | Source Table | Field | Phase Responsible |
|--------|--------------|-------|-------------------|
| Driver Name | `drivers` | `name` | Static |
| Phone | `drivers` | `phone` | Static |
| Rating | `drivers` | `overallRating` | Driver Rating Phase |
| Status | `drivers` | `status` | Driver Telemetry Phase |
| Assigned Truck | `trucks` | `plateNumber` | Driver Telemetry Phase |
| Truck Location | `trucks` + `stations` | Derived from truck location | Movement Phase |
| Battery ID | `trucks` | `batteryId` | Station Operations Phase |
| Last Swap | `swap_transactions` | Latest swap for assigned truck | Station Operations Phase |
| Safety Score | `drivers` | `safetyScore` | Driver Telemetry Phase |

---

## Station Dashboard KPIs

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Total Batteries** | `batteries` | `COUNT(*) WHERE stationId = ?` | Bootstrap Phase |
| **Ready Batteries** | `batteries` | `COUNT(*) WHERE stationId = ? AND status = 'READY'` | Charging Phase |
| **Charging Batteries** | `batteries` | `COUNT(*) WHERE stationId = ? AND status = 'CHARGING'` | Charging Phase |
| **Trucks at Station** | `trucks` | `COUNT(*) WHERE currentStationId = ?` | Movement Phase |
| **Swaps Today** | `swap_transactions` | `COUNT(*) WHERE stationId = ? AND date(timestamp) = date('now')` | Station Operations Phase |
| **Energy Consumed Today** | `swap_transactions` | `SUM(energyDeliveredKwh) WHERE stationId = ? AND date(timestamp) = date('now')` | Station Operations Phase |
| **Energy Charging Now** | `charging_sessions` | `SUM(energyAddedKwh) WHERE stationId = ? AND status = 'ACTIVE'` | Charging Phase |
| **Revenue Today** | `receipts` + `swap_transactions` | `SUM(r.total) WHERE st.stationId = ? AND date(st.timestamp) = date('now')` | Finance Phase |
| **Revenue This Month** | `receipts` + `swap_transactions` | `SUM(r.total) WHERE st.stationId = ? AND strftime('%Y-%m', st.timestamp) = strftime('%Y-%m', 'now')` | Finance Phase |
| **Charger Faults Open** | `charger_faults` | `COUNT(*) WHERE stationId = ? AND status = 'OPEN'` | Incidents/Faults Phase |
| **Queue Size** | `swap_queue` + `trucks` | `COUNT(*) FROM queue WHERE status IN ('PENDING', 'ARRIVED') + COUNT(*) FROM trucks WHERE currentStationId = ? AND status = 'READY'` | Queue Management Phase |

### Charger Status

| Field | Source Table | Calculation | Phase Responsible |
|-------|--------------|-------------|-------------------|
| Charger ID | Derived | `CHG-{stationId}-{index}` | Charging Phase |
| Status | `charging_sessions` + `charger_faults` | `ACTIVE` if session active, `FAULT` if fault exists, else `READY` | Charging Phase, Incidents/Faults Phase |
| Output (kW) | Fixed | `50 kW` per active charger | Charging Phase |
| Battery ID | `charging_sessions` | `batteryId` | Charging Phase |

### Incoming Predictions

| Field | Source Table | Calculation | Phase Responsible |
|-------|--------------|-------------|-------------------|
| Truck Label | `trucks` | `plateNumber` | Movement Phase |
| ETA | Calculated | Distance / 60 km/h | Movement Phase |
| Estimated SOC | `trucks` | `currentSoc - (distance * 0.5)` | Movement Phase |
| Distance | Calculated | Haversine from truck to station | Movement Phase |

---

## Driver Dashboard KPIs

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Current SOC** | `trucks` + `drivers` | `t.currentSoc WHERE d.assignedTruckId = t.id AND d.id = ?` | Movement Phase |
| **Remaining Range** | Calculated | `currentSoc * 3.2` (km) | Derived |
| **Assigned Truck** | `drivers` + `trucks` | `t.plateNumber WHERE d.assignedTruckId = t.id AND d.id = ?` | Driver Telemetry Phase |
| **Next Destination** | `shipments` | `deliveryLocation WHERE driverId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT')` | Freight Phase |
| **Nearest Station** | `stations` + `trucks` | Station with minimum distance from truck | Movement Phase |
| **Estimated Wait** | `swap_queue` + `stations` | `queueSize * 5` (minutes) | Queue Management Phase |

---

## Freight Dashboard KPIs

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Total Shipments** | `shipments` | `COUNT(*) WHERE customerId = ? AND [timeframe]` | Freight Phase |
| **Active Shipments** | `shipments` | `COUNT(*) WHERE customerId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT') AND [timeframe]` | Freight Phase |
| **Delivered Shipments** | `shipments` | `COUNT(*) WHERE customerId = ? AND status = 'DELIVERED' AND [timeframe]` | Freight Phase |
| **Estimated Spend** | `shipments` | `SUM(estimatedPrice) WHERE customerId = ? AND [timeframe]` | Freight Phase |
| **Refrigerated Shipments** | `shipments` | `COUNT(*) WHERE customerId = ? AND requiresRefrigeration = 1 AND [timeframe]` | Freight Phase |
| **Pending Confirmations** | `shipments` | `COUNT(*) WHERE customerId = ? AND status = 'DELIVERED' AND deliveryConfirmedAt IS NULL AND [timeframe]` | Freight Phase |

---

## EEU Dashboard KPIs

| KPI | Source Table/Query | Calculation | Phase Responsible |
|-----|-------------------|-------------|-------------------|
| **Total Network Load (kW)** | `charging_sessions` | `COUNT(*) * 50 WHERE status = 'ACTIVE'` | Charging Phase |
| **Station Energy** | `charging_sessions` | `SUM(energyAddedKwh) WHERE [timeframe]` | Charging Phase |
| **Electricity Delivered** | `receipts` | `SUM(energyCharge) WHERE [timeframe]` | Finance Phase |
| **EEU Revenue Share** | `receipts` | `SUM(eeuShare) WHERE [timeframe]` | Finance Phase |
| **Active Charging Sessions** | `charging_sessions` | `COUNT(*) WHERE status = 'ACTIVE'` | Charging Phase |
| **Peak Load Station** | `charging_sessions` | Station with max `COUNT(*) * 50` | Charging Phase |
| **Forecast Load (24h)** | Historical + Current | Projected based on time of day | Derived (placeholder) |

---

## Data Flow Summary

### Simulation Cycle Order

1. **Bootstrap Phase** - Ensures initial state (batteries, locations, assignments)
2. **Movement Phase** - Updates truck positions, SOC drain
3. **Station Operations Phase** - Processes swaps, battery reassignments
4. **Charging Phase** - Updates battery SOC, charging sessions
5. **Freight Phase** - Creates/transitions shipments
6. **Driver Telemetry Phase** - Updates driver metrics, assignments
7. **Driver Rating Phase** - Updates driver ratings
8. **Battery Health Phase** - Updates cycle counts, health, temperature
9. **Refrigeration Phase** - Updates refrigerated truck temperatures
10. **Queue Management Phase** - Manages swap queue entries
11. **Incidents/Faults Phase** - Generates incidents and charger faults
12. **Finance Phase** - Creates receipts for swaps
13. **Live Feed Phase** - Records truck arrivals
14. **Aggregate Refresh Phase** - Placeholder for future optimizations

---

## Key Simulation Rules

1. **Battery Capacity**: All batteries = **588 kWh** (enforced in Bootstrap Phase)
2. **SOC Drain**: `3% + (refrigerationPowerDraw * 0.25%)` per cycle during transit
3. **Charging**: `10% SOC` increase per cycle, completes at `95%`
4. **Swaps**: Triggered when `SOC < 40` (always) or `SOC < 50` (70% chance)
5. **Driver Assignments**: 60-70% assignment rate, 5-10% detachment chance per cycle
6. **Shipments**: Immediate assignment required, 5-12 active shipments maintained
7. **Receipts**: Created for every swap transaction
8. **Queue**: Distance-based ordering, updated every cycle

---

## End of Documentation

This document serves as the single source of truth for KPI data sources in the A2 Corridor simulation.
