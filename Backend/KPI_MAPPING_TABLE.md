# Dashboard KPI Mapping Table

**Purpose:** Maps each dashboard KPI to its exact source data and calculation rule.

**Format:**
- **Dashboard:** Dashboard name
- **KPI:** KPI name
- **Source Data:** Exact table(s) and fields
- **Calculation Rule:** SQL query or formula
- **Timeframe:** Daily/Monthly/Yearly support

---

## A2 HQ Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Active Trucks** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE status IN ('READY', 'IN_TRANSIT')` | N/A |
| **Swaps Today** | `swap_transactions` table | `SELECT COUNT(*) FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Batteries Ready** | `batteries` table | `SELECT COUNT(*) FROM batteries WHERE status = 'READY'` | N/A |
| **Charging Active** | `charging_sessions` table | `SELECT COUNT(*) FROM charging_sessions WHERE status = 'ACTIVE'` | N/A |
| **Corridor Energy Today** | `swap_transactions` table | `SELECT COALESCE(SUM(energyDeliveredKwh), 0) FROM swap_transactions WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Corridor Revenue** | `receipts` table | `SELECT COALESCE(SUM(total), 0) FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **A2 Share** | `receipts` table | `SELECT COALESCE(SUM(a2Share), 0) FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **EEU Share** | `receipts` table | `SELECT COALESCE(SUM(eeuShare), 0) FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **VAT Collected** | `receipts` table | `SELECT COALESCE(SUM(vat), 0) FROM receipts WHERE date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Stations Online** | `stations` table | `SELECT COUNT(*) FROM stations WHERE status = 'ACTIVE'` | N/A |

---

## Fleet Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Active Trucks** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE fleetId = ? AND status IN ('READY', 'IN_TRANSIT')` | N/A |
| **Available Trucks** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE fleetId = ? AND availability = 'AVAILABLE'` | N/A |
| **Active Drivers** | `drivers` table | `SELECT COUNT(*) FROM drivers WHERE fleetId = ? AND status = 'ACTIVE'` | N/A |
| **Swaps Today** | `swap_transactions` + `trucks` | `SELECT COUNT(*) FROM swap_transactions st INNER JOIN trucks t ON st.truckId = t.id WHERE t.fleetId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Fleet Energy Cost** | `receipts` + `swap_transactions` + `trucks` | `SELECT COALESCE(SUM(r.total), 0) FROM receipts r INNER JOIN swap_transactions st ON r.swapId = st.id INNER JOIN trucks t ON st.truckId = t.id WHERE t.fleetId = ? AND date(r.timestamp, 'localtime') = date('now', 'localtime')` | Daily only (needs monthly/yearly) |
| **Completed Trips** | `shipments` + `trucks` | `SELECT COUNT(*) FROM shipments s INNER JOIN trucks t ON s.truckId = t.id WHERE t.fleetId = ? AND s.status = 'DELIVERED'` | N/A (needs timeframe) |
| **Maintenance Alerts** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE fleetId = ? AND (status = 'MAINTENANCE' OR currentSoc < 20)` | N/A |
| **Refrigerated Active** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE fleetId = ? AND truckType = 'REFRIGERATED' AND status = 'IN_TRANSIT'` | N/A |

---

## Station Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Total Batteries** | `batteries` table | `SELECT COUNT(*) FROM batteries WHERE stationId = ?` | N/A |
| **Ready Batteries** | `batteries` table | `SELECT COUNT(*) FROM batteries WHERE stationId = ? AND status = 'READY'` | N/A |
| **Charging Batteries** | `batteries` table | `SELECT COUNT(*) FROM batteries WHERE stationId = ? AND status = 'CHARGING'` | N/A |
| **Trucks at Station** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE currentStationId = ?` | N/A |
| **Swaps Today** | `swap_transactions` table | `SELECT COUNT(*) FROM swap_transactions WHERE stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Energy Consumed Today** | `swap_transactions` table | `SELECT COALESCE(SUM(energyDeliveredKwh), 0) FROM swap_transactions WHERE stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Energy Charging Now** | `charging_sessions` table | `SELECT COALESCE(SUM(energyAddedKwh), 0) FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE'` | N/A |
| **Revenue Today** | `receipts` + `swap_transactions` | `SELECT COALESCE(SUM(r.total), 0) FROM receipts r INNER JOIN swap_transactions st ON r.swapId = st.id WHERE st.stationId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime')` | Daily only |
| **Revenue This Month** | `receipts` + `swap_transactions` | `SELECT COALESCE(SUM(r.total), 0) FROM receipts r INNER JOIN swap_transactions st ON r.swapId = st.id WHERE st.stationId = ? AND strftime('%Y-%m', st.timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')` | Monthly only |
| **Charger Faults Open** | `charger_faults` table | `SELECT COUNT(*) FROM charger_faults WHERE stationId = ? AND status = 'OPEN'` | N/A |
| **Queue Size** | `swap_queue` + `trucks` | `SELECT (SELECT COUNT(*) FROM swap_queue WHERE stationId = ? AND status IN ('PENDING', 'ARRIVED')) + (SELECT COUNT(*) FROM trucks WHERE currentStationId = ? AND status = 'READY')` | N/A |

---

## Driver Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Current SOC** | `trucks` + `drivers` | `SELECT t.currentSoc FROM trucks t INNER JOIN drivers d ON t.id = d.assignedTruckId WHERE d.id = ?` | N/A |
| **Remaining Range** | Current SOC (from above) | `currentSoc * 3.2` (km) | N/A |
| **Assigned Truck** | `drivers` + `trucks` | `SELECT t.plateNumber FROM drivers d INNER JOIN trucks t ON d.assignedTruckId = t.id WHERE d.id = ?` | N/A |
| **Next Destination** | `shipments` table | `SELECT deliveryLocation FROM shipments WHERE driverId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT') LIMIT 1` | N/A |
| **Nearest Station** | `stations` + `trucks` (for truck location) | Calculate distance from truck `locationLat/locationLng` to all stations, return station with minimum distance | N/A |
| **Estimated Wait** | Nearest station queue | `queueSize * 5` (minutes, estimated) | N/A |

---

## Freight Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Total Shipments** | `shipments` table | `SELECT COUNT(*) FROM shipments WHERE customerId = ? AND [timeframe filter]` | Daily/Monthly/Yearly |
| **Active Shipments** | `shipments` table | `SELECT COUNT(*) FROM shipments WHERE customerId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT') AND [timeframe filter]` | Daily/Monthly/Yearly |
| **Delivered Shipments** | `shipments` table | `SELECT COUNT(*) FROM shipments WHERE customerId = ? AND status = 'DELIVERED' AND [timeframe filter]` | Daily/Monthly/Yearly |
| **Estimated Spend** | `shipments` table | `SELECT COALESCE(SUM(estimatedPrice), 0) FROM shipments WHERE customerId = ? AND [timeframe filter]` (estimatedPrice calculated from weight, volume, refrigeration) | Daily/Monthly/Yearly |
| **Refrigerated Shipments** | `shipments` table | `SELECT COUNT(*) FROM shipments WHERE customerId = ? AND requiresRefrigeration = 1 AND [timeframe filter]` | Daily/Monthly/Yearly |
| **Pending Delivery Confirmations** | `shipments` table | `SELECT COUNT(*) FROM shipments WHERE customerId = ? AND status = 'DELIVERED' AND deliveryConfirmedAt IS NULL AND [timeframe filter]` | Daily/Monthly/Yearly |

**Timeframe Filters:**
- Daily: `date(assignedAt, 'localtime') = date('now', 'localtime')`
- Monthly: `strftime('%Y-%m', assignedAt, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
- Yearly: `strftime('%Y', assignedAt, 'localtime') = strftime('%Y', 'now', 'localtime')`

---

## EEU Dashboard

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Total Network Load (kW)** | `charging_sessions` table | `SELECT COUNT(*) * 50 FROM charging_sessions WHERE status = 'ACTIVE'` (50 kW per active charger) | N/A (live) |
| **Station Energy** | `charging_sessions` table | `SELECT COALESCE(SUM(energyAddedKwh), 0) FROM charging_sessions WHERE [timeframe filter]` | Daily/Monthly/Yearly |
| **Electricity Delivered** | `receipts` table | `SELECT COALESCE(SUM(energyCharge), 0) FROM receipts WHERE [timeframe filter]` | Daily/Monthly/Yearly |
| **EEU Revenue Share** | `receipts` table | `SELECT COALESCE(SUM(eeuShare), 0) FROM receipts WHERE [timeframe filter]` | Daily/Monthly/Yearly |
| **Active Charging Sessions** | `charging_sessions` table | `SELECT COUNT(*) FROM charging_sessions WHERE status = 'ACTIVE'` | N/A |
| **Peak Load Station** | `charging_sessions` grouped by `stationId` | `SELECT s.stationId, COUNT(*) * 50 as load FROM charging_sessions cs INNER JOIN stations s ON cs.stationId = s.id WHERE cs.status = 'ACTIVE' GROUP BY s.stationId ORDER BY load DESC LIMIT 1` | N/A |
| **Forecast Load (24h)** | Historical patterns + current sessions | Projected load based on time of day and current trends (placeholder) | N/A |

**Timeframe Filters:**
- Daily: `date(startTime, 'localtime') = date('now', 'localtime')`
- Monthly: `strftime('%Y-%m', startTime, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
- Yearly: `strftime('%Y', startTime, 'localtime') = strftime('%Y', 'now', 'localtime')`

---

## System Health KPIs (A2 HQ Tab)

| KPI | Source Data | Calculation Rule | Timeframe |
|-----|-------------|-------------------|-----------|
| **Stations Online** | `stations` table | `SELECT COUNT(*) FROM stations WHERE status = 'ACTIVE'` | N/A |
| **Stations Offline** | `stations` table | `SELECT COUNT(*) FROM stations WHERE status = 'INACTIVE'` | N/A |
| **Trucks Active** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE status IN ('READY', 'IN_TRANSIT')` | N/A |
| **Trucks Idle** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE status = 'IDLE'` | N/A |
| **Trucks Maintenance** | `trucks` table | `SELECT COUNT(*) FROM trucks WHERE status = 'MAINTENANCE'` | N/A |
| **Drivers Active** | `drivers` table | `SELECT COUNT(*) FROM drivers WHERE status = 'ACTIVE'` | N/A |
| **Drivers Inactive** | `drivers` table | `SELECT COUNT(*) FROM drivers WHERE status IN ('AVAILABLE', 'ON_DUTY', 'RESTING')` | N/A |
| **Network Utilization** | Calculated | `((activeTrucks / totalTrucks) + (activeStations / totalStations)) / 2 * 100` | N/A |
| **Average Swap Time** | `swap_transactions` table | Calculate average time between truck arrival and swap completion (needs `truck_arrivals` table) | N/A |
| **Average Charging Time** | `charging_sessions` table | `SELECT AVG((julianday(endTime) - julianday(startTime)) * 24 * 60) FROM charging_sessions WHERE status = 'COMPLETED'` (minutes) | N/A |

---

## Notes

1. **Date Filtering:** All date comparisons use `date('now', 'localtime')` to ensure correct local date filtering.

2. **Null Handling:** All aggregations use `COALESCE(SUM(...), 0)` to return 0 instead of null.

3. **Rounding:** 
   - Currency values: Round to 2 decimal places
   - Percentages: Round to 1 decimal place
   - Counts: Integer values

4. **Timeframe Support:** 
   - KPIs marked "Daily only" need monthly/yearly support added
   - Use `strftime()` for monthly/yearly filtering

5. **Real-time vs Aggregated:**
   - "Live" KPIs (e.g., Total Network Load) are calculated from current state
   - "Today" KPIs are aggregated from transactions with date filter
   - "Timeframe" KPIs support daily/monthly/yearly aggregation

---

## End of Mapping Table

This table provides the exact source data and calculation rules for every dashboard KPI. All simulation implementations must ensure these calculations produce accurate results.
