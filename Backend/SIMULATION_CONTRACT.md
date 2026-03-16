# A2 Corridor Simulation Contract

**Version:** 1.0  
**Last Updated:** 2024  
**Purpose:** Canonical specification for what the A2 Corridor simulation must produce every cycle to keep all dashboards synchronized.

---

## 1. Core Simulated Entities

### 1.1 Stations

**Required Fields:**
- `id: number` - Unique station identifier
- `name: string` - Station name (e.g., "Addis Ababa (Main Hub)")
- `location: string` - Location description
- `locationLat: number` - Latitude coordinate (required for distance calculations)
- `locationLng: number` - Longitude coordinate (required for distance calculations)
- `status: "ACTIVE" | "INACTIVE"` - Operational status
- `capacity: number` - Station capacity (battery slots)
- `maxQueueSize: number` - Maximum queue size (default: 20)
- `swapBayCount: number` - Number of swap bays (default: 2-4)

**Simulation Rules:**
- Stations are static (coordinates don't change)
- Status must be `ACTIVE` for operations
- Coordinates must be set for incoming predictions to work

---

### 1.2 Trucks

**Required Fields:**
- `id: number` - Unique truck identifier
- `plateNumber: string` - License plate (e.g., "ET-1001")
- `fleetId: number` - Owner fleet identifier
- `truckType: "STANDARD" | "REFRIGERATED"` - Truck type
- `batteryId: string | null` - Current battery ID (null if no battery)
- `status: "READY" | "IN_TRANSIT" | "MAINTENANCE" | "IDLE"` - Operational status
- `availability: "AVAILABLE" | "ACTIVE" | "IDLE"` - Availability status
- `currentSoc: number` - State of charge (0-100%)
- `currentStationId: number | null` - Current station (null if in transit)
- `locationLat: number | null` - Current latitude (updated every cycle during transit)
- `locationLng: number | null` - Current longitude (updated every cycle during transit)
- `assignedDriverId: number | null` - Assigned driver (null if unassigned)
- `refrigerationPowerDraw: number` - Power draw for refrigerated trucks (kW, default: 0)
- `temperatureTarget: number | null` - Target temperature for refrigerated trucks (°C)
- `temperatureCurrent: number | null` - Current temperature for refrigerated trucks (°C)

**Simulation Rules:**
- Location must be updated continuously during `IN_TRANSIT` status
- SOC drains during transit: `baseDrop = 3%` + `(refrigerationPowerDraw * 0.25%)` per cycle
- `currentStationId` must be `NULL` when `status = IN_TRANSIT`
- `currentStationId` must be set when `status = READY` at a station
- Trucks can only start movement if `assignedDriverId` is not null
- Refrigerated trucks must have `temperatureCurrent` and `temperatureTarget` set

---

### 1.3 Drivers

**Required Fields:**
- `id: number` - Unique driver identifier
- `name: string` - Driver full name
- `phone: string` - Phone number
- `fleetId: number` - Owner fleet identifier
- `assignedTruckId: number | null` - Assigned truck (null if unassigned)
- `status: "AVAILABLE" | "ON_DUTY" | "RESTING" | "ACTIVE"` - Driver status
- `overallRating: number` - Overall rating (0-5, updated based on performance)
- `safetyScore: number` - Safety score (0-100, updated via telemetry)
- `speedViolations: number` - Count of speed violations (updated via telemetry)
- `harshBrakes: number` - Count of harsh brake events (updated via telemetry)
- `completedTrips: number` - Count of completed shipments
- `tripEfficiency: number` - Trip efficiency ratio (completed / assigned, 0-1)

**Simulation Rules:**
- Assignment rate: 60-70% of available drivers should be assigned
- Detachment rate: 5-10% chance per cycle for random detachments
- New assignment rate: 5-10% chance per cycle for new assignments
- Status must be `ACTIVE` when `assignedTruckId` is not null and truck is `IN_TRANSIT`
- `safetyScore` decreases by 0.6 per violation (speed > 95 km/h or brakeForce > 0.85)
- `overallRating` should be updated based on `completedTrips` and `safetyScore`
- `tripEfficiency` = `completedTrips / (completedTrips + activeAssignments)`

---

### 1.4 Batteries

**Required Fields:**
- `id: number` - Unique battery identifier
- `capacityKwh: number` - **STANDARDIZED: 588 kWh** (unless explicitly overridden)
- `soc: number` - State of charge (0-100%)
- `status: "READY" | "CHARGING" | "IN_TRUCK" | "MAINTENANCE"` - Battery status
- `stationId: number | null` - Current station (null if in truck)
- `truckId: number | null` - Current truck (null if at station)
- `health: number` - Battery health percentage (0-100, degrades with cycles)
- `cycleCount: number` - Number of charge/discharge cycles
- `temperature: number` - Battery temperature (°C, increases during charging)

**Simulation Rules:**
- **Capacity Standard:** All batteries must use 588 kWh unless explicitly overridden
- Status transitions:
  - `READY` → `CHARGING` when charging starts
  - `CHARGING` → `READY` when SOC reaches 95%
  - `READY` → `IN_TRUCK` when swapped into truck
  - `IN_TRUCK` → `CHARGING` when swapped out of truck
- `cycleCount` must increment when battery is swapped out of truck
- `health` degrades by 0.01% per cycle (minimum 50%)
- `temperature` increases by 1-2°C during charging (max 35°C)
- Only one of `stationId` or `truckId` can be non-null at a time

---

### 1.5 Shipments

**Required Fields:**
- `id: number` - Unique shipment identifier
- `customerId: number` - Customer identifier (for visibility scoping)
- `pickupLocation: string` - Pickup location name
- `pickupLat: number` - Pickup latitude
- `pickupLng: number` - Pickup longitude
- `deliveryLocation: string` - Delivery location name
- `deliveryLat: number` - Delivery latitude
- `deliveryLng: number` - Delivery longitude
- `cargoDescription: string` - Cargo description
- `weight: number` - Weight in tonnes
- `volume: number` - Volume in m³
- `pickupWindow: string` - Pickup time window (e.g., "06:00-10:00")
- `requiresRefrigeration: number` - Boolean (0 or 1)
- `temperatureTarget: number | null` - Target temperature if refrigerated (°C)
- `truckId: number | null` - Assigned truck (null if not assigned)
- `driverId: number | null` - Assigned driver (null if not assigned)
- `status: "REQUESTED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED"` - Shipment status
- `approvedLoad: number` - Boolean (0 or 1)
- `assignedAt: string | null` - Assignment timestamp (ISO 8601)
- `acceptedAt: string | null` - Acceptance timestamp (ISO 8601)
- `pickupConfirmedAt: string | null` - Pickup confirmation timestamp (ISO 8601)
- `deliveryConfirmedAt: string | null` - Delivery confirmation timestamp (ISO 8601)

**Simulation Rules:**
- **Immediate Assignment:** Shipment creation must immediately assign truck+driver or reject (409 Conflict)
- Assignment criteria:
  - Truck: `status = READY`, `availability = AVAILABLE`, matching `truckType` if refrigerated
  - Driver: `fleetId` matches truck's `fleetId`, `status = AVAILABLE`
  - Selection: Closest truck to pickup location (by distance), then highest SOC
- Status transitions:
  - `REQUESTED` → `ASSIGNED` (immediate on creation)
  - `ASSIGNED` → `IN_TRANSIT` (3-4 per cycle, sets `pickupConfirmedAt`)
  - `IN_TRANSIT` → `DELIVERED` (2-3 per cycle, sets `deliveryConfirmedAt`)
- Active shipments: Maintain 5-12 active shipments (`ASSIGNED` or `IN_TRANSIT`)
- Completion rate: 2-3 shipments delivered per cycle

---

### 1.6 Swap Transactions

**Required Fields:**
- `id: number` - Unique swap identifier
- `truckId: number` - Truck receiving battery
- `stationId: number` - Station performing swap
- `incomingBatteryId: number` - Battery being installed
- `outgoingBatteryId: number` - Battery being removed
- `arrivalSoc: number` - SOC of outgoing battery at arrival (0-100%)
- `energyDeliveredKwh: number` - Energy delivered to truck (kWh)
- `timestamp: string` - Swap timestamp (ISO 8601)

**Simulation Rules:**
- Must be created for every battery swap
- `energyDeliveredKwh` = `(incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100 + extraEnergy`
  - `extraEnergy` = `refrigerationPowerDraw` if truck is refrigerated, else 0
- Swap triggers:
  - When truck arrives at station with `currentSoc < 40`
  - When truck arrives at station with `currentSoc < 50` and random chance (70%)
- After swap:
  - Outgoing battery: `stationId` = swap station, `truckId` = null, `status` = `CHARGING`, `soc` = `arrivalSoc`
  - Incoming battery: `stationId` = null, `truckId` = truck ID, `status` = `IN_TRUCK`
  - Truck: `batteryId` = incoming battery ID, `currentSoc` = incoming battery SOC

---

### 1.7 Charging Sessions

**Required Fields:**
- `id: number` - Unique session identifier
- `stationId: number` - Station where charging occurs
- `batteryId: number` - Battery being charged
- `startTime: string` - Session start timestamp (ISO 8601)
- `endTime: string | null` - Session end timestamp (ISO 8601, null if active)
- `startSoc: number` - SOC at session start (0-100%)
- `currentSoc: number` - Current SOC (0-100%, updated every cycle)
- `targetSoc: number` - Target SOC (default: 95%)
- `energyAddedKwh: number` - Total energy added (kWh, updated every cycle)
- `estimatedCompletion: string | null` - Estimated completion timestamp (ISO 8601)
- `status: "ACTIVE" | "COMPLETED" | "CANCELLED"` - Session status

**Simulation Rules:**
- Created when battery needs charging:
  - Battery `status = CHARGING` OR (`status = READY` AND `soc < 95`)
  - Battery `stationId` is not null
- Charging window: Only charge during configured window (default: 20:00-06:00)
- SOC progression: Increase by 10% per cycle (or to `targetSoc`, whichever is lower)
- Energy calculation: `energyAddedKwh` = `(battery.capacityKwh * (currentSoc - startSoc)) / 100`
- Completion: When `currentSoc >= targetSoc`, set `status = COMPLETED`, `endTime = timestamp`, battery `status = READY`
- Estimated completion: `startTime + ((targetSoc - currentSoc) / 10) * SIMULATION_INTERVAL_MS`

---

### 1.8 Receipts

**Required Fields:**
- `id: number` - Unique receipt identifier
- `swapId: number` - Linked swap transaction ID
- `energyKwh: number` - Energy delivered (kWh, from swap)
- `energyCharge: number` - Energy charge (ETB) = `energyKwh * eeuRatePerKwh`
- `serviceCharge: number` - Service charge (ETB) = `energyKwh * a2ServiceRatePerKwh`
- `vat: number` - VAT (ETB) = `(energyCharge + serviceCharge) * (vatPercent / 100)`
- `total: number` - Total amount (ETB) = `energyCharge + serviceCharge + vat`
- `eeuShare: number` - EEU revenue share (ETB) = `energyCharge + (vat / 2)`
- `a2Share: number` - A2 revenue share (ETB) = `serviceCharge + (vat / 2)`
- `paymentMethod: string` - Payment method (e.g., "Telebirr", "CBE", "M-Pesa", "Bank Transfer")
- `timestamp: string` - Receipt timestamp (ISO 8601)

**Simulation Rules:**
- **Must be created for every swap transaction**
- Tariff source: `tariff_config` table (default: `eeuRatePerKwh = 10`, `a2ServiceRatePerKwh = 10`, `vatPercent = 15`)
- Payment method: Randomly selected from available methods
- All amounts rounded to 2 decimal places

---

### 1.9 Incidents

**Required Fields:**
- `id: number` - Unique incident identifier
- `stationId: number` - Station where incident occurred
- `type: string` - Incident type (e.g., "QUEUE_CONGESTION", "CHARGER_FAULT", "BATTERY_SHORTAGE", "POWER_OUTAGE")
- `severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"` - Incident severity
- `message: string` - Incident description
- `status: "OPEN" | "RESOLVED" | "ACKNOWLEDGED"` - Incident status
- `reportedAt: string` - Report timestamp (ISO 8601)
- `resolvedAt: string | null` - Resolution timestamp (ISO 8601, null if open)

**Simulation Rules:**
- Queue congestion: Created when queue size exceeds threshold (40% chance per cycle)
- Charger fault: Created when charger fault occurs (see Charger Faults)
- Battery shortage: Created when ready batteries < 10% of station capacity
- Power outage: Rare (0.1% chance per cycle per station)

---

### 1.10 Charger Faults

**Required Fields:**
- `id: number` - Unique fault identifier
- `stationId: number` - Station where fault occurred
- `chargerId: string` - Charger identifier (e.g., "CHG-01")
- `errorCode: string` - Error code (e.g., "E114", "E201")
- `description: string` - Fault description
- `status: "OPEN" | "RESOLVED"` - Fault status
- `reportedAt: string` - Report timestamp (ISO 8601)
- `resolvedAt: string | null` - Resolution timestamp (ISO 8601, null if open)

**Simulation Rules:**
- Fault generation: 1-2% chance per cycle per active charger
- Error codes: Random from predefined set (e.g., "E114", "E201", "E305")
- Auto-resolution: 10-20% chance per cycle for open faults
- When fault occurs: Charger status set to `FAULT`, battery charging stops

---

### 1.11 Queue Entries

**Required Fields:**
- `id: number` - Unique queue entry identifier
- `truckId: number` - Truck in queue
- `stationId: number` - Station queue
- `bookedAt: string` - Booking timestamp (ISO 8601)
- `estimatedArrival: string | null` - Estimated arrival timestamp (ISO 8601)
- `distanceKm: number` - Distance from station (km)
- `status: "PENDING" | "ARRIVED" | "PROCESSING" | "COMPLETED" | "CANCELLED"` - Queue status

**Simulation Rules:**
- Created when truck needs swap and is heading to station
- Ordered by `distanceKm` (ascending)
- `distanceKm` calculated using Haversine formula from truck location to station
- Removed when swap completes (`status = COMPLETED`)
- Queue size = count of entries with `status = PENDING` or `status = ARRIVED`

---

### 1.12 Live Activity Events

**Required Fields:**
- `id: number` - Unique event identifier
- `eventType: string` - Event type (e.g., "SWAP", "TRUCK_ARRIVAL", "INCIDENT", "CHARGING_START", "CHARGING_COMPLETE")
- `entityType: string` - Entity type (e.g., "TRUCK", "BATTERY", "STATION", "SHIPMENT")
- `entityId: number` - Entity identifier
- `message: string` - Event message
- `timestamp: string` - Event timestamp (ISO 8601)
- `severity: "INFO" | "WARNING" | "ERROR" | null` - Event severity (optional)

**Simulation Rules:**
- Generated for:
  - Swap completions
  - Truck arrivals at stations
  - Incident creation
  - Charging session start/complete
  - Shipment status transitions
  - Driver-truck assignments/detachments
- Stored in database or generated on-demand for recent events (last 24 hours)

---

## 2. Derived KPI Groups

### 2.1 A2 HQ Dashboard KPIs

**Source:** All entities (full system access)

1. **Active Trucks**
   - Source: `trucks` table
   - Filter: `status IN ('READY', 'IN_TRANSIT')`
   - Calculation: `COUNT(*)`

2. **Swaps Today**
   - Source: `swap_transactions` table
   - Filter: `date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COUNT(*)`

3. **Batteries Ready**
   - Source: `batteries` table
   - Filter: `status = 'READY'`
   - Calculation: `COUNT(*)`

4. **Charging Active**
   - Source: `charging_sessions` table
   - Filter: `status = 'ACTIVE'`
   - Calculation: `COUNT(*)`

5. **Corridor Energy Today (kWh/day)**
   - Source: `swap_transactions` table
   - Filter: `date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(energyDeliveredKwh), 0)`

6. **Corridor Revenue**
   - Source: `receipts` table joined with `swap_transactions`
   - Filter: `date(r.timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(r.total), 0)`

7. **A2 Share**
   - Source: `receipts` table
   - Filter: `date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(a2Share), 0)`

8. **EEU Share**
   - Source: `receipts` table
   - Filter: `date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(eeuShare), 0)`

9. **VAT Collected**
   - Source: `receipts` table
   - Filter: `date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(vat), 0)`

10. **Stations Online**
    - Source: `stations` table
    - Filter: `status = 'ACTIVE'`
    - Calculation: `COUNT(*)`

---

### 2.2 Fleet Dashboard KPIs

**Source:** Fleet-scoped entities (`fleetId = user.organizationId`)

1. **Active Trucks**
   - Source: `trucks` table
   - Filter: `fleetId = ? AND status IN ('READY', 'IN_TRANSIT')`
   - Calculation: `COUNT(*)`

2. **Available Trucks**
   - Source: `trucks` table
   - Filter: `fleetId = ? AND availability = 'AVAILABLE'`
   - Calculation: `COUNT(*)`

3. **Active Drivers**
   - Source: `drivers` table
   - Filter: `fleetId = ? AND status = 'ACTIVE'`
   - Calculation: `COUNT(*)`

4. **Swaps Today**
   - Source: `swap_transactions` joined with `trucks`
   - Filter: `t.fleetId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COUNT(*)`

5. **Fleet Energy Cost**
   - Source: `receipts` joined with `swap_transactions` joined with `trucks`
   - Filter: `t.fleetId = ? AND date(r.timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(r.total), 0)`

6. **Completed Trips**
   - Source: `shipments` joined with `trucks`
   - Filter: `t.fleetId = ? AND s.status = 'DELIVERED'`
   - Calculation: `COUNT(*)`

7. **Maintenance Alerts**
   - Source: `trucks` table
   - Filter: `fleetId = ? AND (status = 'MAINTENANCE' OR currentSoc < 20)`
   - Calculation: `COUNT(*)`

8. **Refrigerated Active**
   - Source: `trucks` table
   - Filter: `fleetId = ? AND truckType = 'REFRIGERATED' AND status = 'IN_TRANSIT'`
   - Calculation: `COUNT(*)`

---

### 2.3 Station Dashboard KPIs

**Source:** Station-scoped entities (`stationId = user.organizationId`)

1. **Total Batteries**
   - Source: `batteries` table
   - Filter: `stationId = ?`
   - Calculation: `COUNT(*)`

2. **Ready Batteries**
   - Source: `batteries` table
   - Filter: `stationId = ? AND status = 'READY'`
   - Calculation: `COUNT(*)`

3. **Charging Batteries**
   - Source: `batteries` table
   - Filter: `stationId = ? AND status = 'CHARGING'`
   - Calculation: `COUNT(*)`

4. **Trucks at Station**
   - Source: `trucks` table
   - Filter: `currentStationId = ?`
   - Calculation: `COUNT(*)`

5. **Swaps Today**
   - Source: `swap_transactions` table
   - Filter: `stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COUNT(*)`

6. **Energy Consumed Today**
   - Source: `swap_transactions` table
   - Filter: `stationId = ? AND date(timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(energyDeliveredKwh), 0)`

7. **Energy Charging Now**
   - Source: `charging_sessions` table
   - Filter: `stationId = ? AND status = 'ACTIVE'`
   - Calculation: `COALESCE(SUM(energyAddedKwh), 0)`

8. **Revenue Today**
   - Source: `receipts` joined with `swap_transactions`
   - Filter: `st.stationId = ? AND date(st.timestamp, 'localtime') = date('now', 'localtime')`
   - Calculation: `COALESCE(SUM(r.total), 0)`

9. **Revenue This Month**
   - Source: `receipts` joined with `swap_transactions`
   - Filter: `st.stationId = ? AND strftime('%Y-%m', st.timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`
   - Calculation: `COALESCE(SUM(r.total), 0)`

10. **Charger Faults Open**
    - Source: `charger_faults` table
    - Filter: `stationId = ? AND status = 'OPEN'`
    - Calculation: `COUNT(*)`

11. **Queue Size**
    - Source: `swap_queue` table + `trucks` table
    - Filter: `(stationId = ? AND status IN ('PENDING', 'ARRIVED')) OR (currentStationId = ? AND status = 'READY')`
    - Calculation: `COUNT(*)` from queue + `COUNT(*)` from trucks

---

### 2.4 Driver Dashboard KPIs

**Source:** Driver-scoped entities (`driverId = user.organizationId`)

1. **Current SOC**
   - Source: `trucks` table joined with `drivers`
   - Filter: `d.id = ? AND d.assignedTruckId = t.id`
   - Calculation: `t.currentSoc`

2. **Remaining Range**
   - Source: Current SOC (from above)
   - Calculation: `currentSoc * 3.2` (km)

3. **Assigned Truck**
   - Source: `drivers` table
   - Filter: `id = ?`
   - Calculation: `assignedTruckId` → lookup truck `plateNumber`

4. **Next Destination**
   - Source: `shipments` table
   - Filter: `driverId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT')`
   - Calculation: `deliveryLocation`

5. **Nearest Station**
   - Source: `stations` table + `trucks` table (for truck location)
   - Filter: All stations, calculate distance from truck location
   - Calculation: Station with minimum distance

6. **Estimated Wait**
   - Source: Nearest station queue size
   - Calculation: `queueSize * 5` (minutes, estimated)

---

### 2.5 Freight Dashboard KPIs

**Source:** Customer-scoped entities (`customerId = user.organizationId`)

1. **Total Shipments**
   - Source: `shipments` table
   - Filter: `customerId = ? AND [timeframe filter]`
   - Calculation: `COUNT(*)`

2. **Active Shipments**
   - Source: `shipments` table
   - Filter: `customerId = ? AND status IN ('ASSIGNED', 'IN_TRANSIT') AND [timeframe filter]`
   - Calculation: `COUNT(*)`

3. **Delivered Shipments**
   - Source: `shipments` table
   - Filter: `customerId = ? AND status = 'DELIVERED' AND [timeframe filter]`
   - Calculation: `COUNT(*)`

4. **Estimated Spend**
   - Source: `shipments` table (estimated price calculation)
   - Filter: `customerId = ? AND [timeframe filter]`
   - Calculation: `SUM(estimatedPrice)` (calculated from weight, volume, refrigeration)

5. **Refrigerated Shipments**
   - Source: `shipments` table
   - Filter: `customerId = ? AND requiresRefrigeration = 1 AND [timeframe filter]`
   - Calculation: `COUNT(*)`

6. **Pending Delivery Confirmations**
   - Source: `shipments` table
   - Filter: `customerId = ? AND status = 'DELIVERED' AND deliveryConfirmedAt IS NULL AND [timeframe filter]`
   - Calculation: `COUNT(*)`

---

### 2.6 EEU Dashboard KPIs

**Source:** Network-wide energy data (all stations)

1. **Total Network Load (kW, live)**
   - Source: `charging_sessions` table
   - Filter: `status = 'ACTIVE'`
   - Calculation: `SUM(outputKw)` per session (default: 50 kW per active charger)

2. **Station Energy (kWh/{timeframe})**
   - Source: `charging_sessions` table
   - Filter: `[timeframe filter]`
   - Calculation: `COALESCE(SUM(energyAddedKwh), 0)`

3. **Electricity Delivered ({timeframe})**
   - Source: `receipts` table
   - Filter: `[timeframe filter]`
   - Calculation: `COALESCE(SUM(energyCharge), 0)` (ETB)

4. **EEU Revenue Share ({timeframe})**
   - Source: `receipts` table
   - Filter: `[timeframe filter]`
   - Calculation: `COALESCE(SUM(eeuShare), 0)` (ETB)

5. **Active Charging Sessions**
   - Source: `charging_sessions` table
   - Filter: `status = 'ACTIVE'`
   - Calculation: `COUNT(*)`

6. **Peak Load Station**
   - Source: `charging_sessions` grouped by `stationId`
   - Filter: `status = 'ACTIVE'`
   - Calculation: Station with maximum `SUM(outputKw)`

7. **Forecast Load (24h)**
   - Source: Historical charging patterns + current active sessions
   - Calculation: Projected load based on time of day and current trends (placeholder for now)

---

## 3. Financial Simulation Rules

### 3.1 Tariff Configuration

**Source:** `tariff_config` table (single row, id = 1)

**Default Values:**
- `eeuRatePerKwh: number` = 10 ETB/kWh
- `a2ServiceRatePerKwh: number` = 10 ETB/kWh
- `vatPercent: number` = 15%

**Usage:**
- All receipt calculations must use values from this table
- If table is empty, use default values

---

### 3.2 Per-Swap Billing Calculation

**Input:**
- `energyDeliveredKwh: number` (from swap transaction)
- `eeuRatePerKwh: number` (from tariff config)
- `a2ServiceRatePerKwh: number` (from tariff config)
- `vatPercent: number` (from tariff config)

**Calculations:**
1. `energyCharge = energyDeliveredKwh * eeuRatePerKwh`
2. `serviceCharge = energyDeliveredKwh * a2ServiceRatePerKwh`
3. `subtotal = energyCharge + serviceCharge`
4. `vat = subtotal * (vatPercent / 100)`
5. `total = subtotal + vat`
6. `eeuShare = energyCharge + (vat / 2)`
7. `a2Share = serviceCharge + (vat / 2)`

**Rounding:** All amounts rounded to 2 decimal places

---

### 3.3 Revenue Aggregation

**Per-Station Revenue:**
- Source: `receipts` joined with `swap_transactions`
- Filter: `swap_transactions.stationId = ? AND [date filter]`
- Calculation: `SUM(receipts.total)`

**Per-Fleet Energy Cost:**
- Source: `receipts` joined with `swap_transactions` joined with `trucks`
- Filter: `trucks.fleetId = ? AND [date filter]`
- Calculation: `SUM(receipts.total)`

**Corridor Revenue:**
- Source: `receipts` table
- Filter: `[date filter]`
- Calculation: `SUM(receipts.total)`

**A2 Share:**
- Source: `receipts` table
- Filter: `[date filter]`
- Calculation: `SUM(receipts.a2Share)`

**EEU Share:**
- Source: `receipts` table
- Filter: `[date filter]`
- Calculation: `SUM(receipts.eeuShare)`

**VAT Collected:**
- Source: `receipts` table
- Filter: `[date filter]`
- Calculation: `SUM(receipts.vat)`

---

## 4. Battery Rules

### 4.1 Capacity Standardization

**Rule:** All batteries must use **588 kWh** capacity unless explicitly overridden.

**Enforcement:**
- `ensureSimulationBatteries()` must create batteries with `capacityKwh = 588`
- `config.routes.ts` battery creation must use `capacityKwh = 588`
- Any manual battery creation should default to 588 kWh

---

### 4.2 Battery Status Transitions

**State Machine:**
```
READY → CHARGING (when charging starts)
CHARGING → READY (when SOC >= 95%)
READY → IN_TRUCK (when swapped into truck)
IN_TRUCK → CHARGING (when swapped out of truck)
[Any] → MAINTENANCE (manual or health < 50%)
MAINTENANCE → READY (after maintenance)
```

**Rules:**
- Only one status can be active at a time
- Status must match location (`IN_TRUCK` requires `truckId`, others require `stationId`)

---

### 4.3 Charging Behavior

**Charging Window:**
- Default: 20:00 - 06:00 (configurable via `charging_window_config`)
- Charging only occurs during window hours
- Exception: During demo hours, charging continues to show activity

**SOC Progression:**
- Increment: 10% per simulation cycle (or to `targetSoc`, whichever is lower)
- Energy added: `(capacityKwh * (currentSoc - startSoc)) / 100`
- Completion: When `currentSoc >= targetSoc` (default: 95%)

**Temperature:**
- Increases by 1-2°C during charging
- Maximum: 35°C
- Decreases when not charging

---

### 4.4 Swap Behavior

**Swap Triggers:**
1. Truck arrives at station with `currentSoc < 40` → Always swap
2. Truck arrives at station with `currentSoc < 50` → 70% chance to swap

**Swap Process:**
1. Select highest SOC `READY` battery at station
2. Calculate `energyDeliveredKwh` = `(incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100 + extraEnergy`
3. Update outgoing battery: `stationId` = station, `truckId` = null, `status` = `CHARGING`, `soc` = `arrivalSoc`
4. Update incoming battery: `stationId` = null, `truckId` = truck, `status` = `IN_TRUCK`
5. Update truck: `batteryId` = incoming battery ID, `currentSoc` = incoming battery SOC
6. Create swap transaction
7. Create receipt

---

### 4.5 Health and Cycle Count Evolution

**Cycle Count:**
- Increments when battery is swapped out of truck
- Tracks number of charge/discharge cycles

**Health Degradation:**
- Degrades by 0.01% per cycle
- Minimum: 50%
- Formula: `health = Math.max(50, health - 0.01)`

**Temperature Updates:**
- During charging: `temperature = Math.min(35, temperature + random(1, 2))`
- When idle: `temperature = Math.max(20, temperature - 0.5)`

---

## 5. Time Progression Rules

### 5.1 Simulation Tick Behavior

**Interval:** 10 seconds (`SIMULATION_INTERVAL_MS = 10_000`)

**Cycle Order:**
1. Ensure initial data (batteries, locations, driver assignments)
2. Update truck locations (if `IN_TRANSIT`)
3. Drain truck SOC (if `IN_TRANSIT`)
4. Process swaps (if truck arrives at station)
5. Process charging (if in charging window)
6. Process driver assignments/detachments
7. Process driver telemetry
8. Process freight pipeline (create/transition shipments)
9. Emit station operations signals (arrivals, incidents)
10. Generate live activity events

---

### 5.2 Truck Movement Updates

**During Transit:**
- Update `locationLat` and `locationLng` every cycle
- Use linear interpolation between stations
- Progress: 0.3-0.5 per cycle (varies by truck)
- Set `currentStationId = NULL` when leaving station
- Set `currentStationId = stationId` when arriving

**SOC Drain:**
- Base drain: 3% per cycle
- Extra drain: `refrigerationPowerDraw * 0.25%` per cycle (for refrigerated trucks)
- Formula: `newSoc = Math.max(0, currentSoc - (baseDrop + extraDrop))`

---

### 5.3 Shipment Progression Updates

**Creation:**
- Create 1-3 new shipments per cycle (if active count < 5)
- Immediate assignment required (or reject with 409)
- Status: `REQUESTED` → `ASSIGNED` (immediate)

**Transitions:**
- `ASSIGNED` → `IN_TRANSIT`: 3-4 per cycle, sets `pickupConfirmedAt`
- `IN_TRANSIT` → `DELIVERED`: 2-3 per cycle, sets `deliveryConfirmedAt`

**Completion:**
- Increment driver `completedTrips`
- Set truck `status = READY`, `availability = AVAILABLE`

---

### 5.4 Charging Progression Updates

**Session Creation:**
- Check batteries with `status = CHARGING` OR (`status = READY` AND `soc < 95`)
- Create session if not exists
- Set `startSoc = battery.soc`, `currentSoc = battery.soc`, `targetSoc = 95`

**SOC Updates:**
- Increment `currentSoc` by 10% per cycle (or to `targetSoc`)
- Update `energyAddedKwh` = `(capacityKwh * (currentSoc - startSoc)) / 100`
- Update battery `soc` to match `currentSoc`

**Completion:**
- When `currentSoc >= targetSoc`:
  - Set session `status = COMPLETED`, `endTime = timestamp`
  - Set battery `status = READY`

---

### 5.5 Live Feed Event Generation

**Event Types:**
- `SWAP` - Swap transaction completed
- `TRUCK_ARRIVAL` - Truck arrived at station
- `INCIDENT` - Station incident created
- `CHARGING_START` - Charging session started
- `CHARGING_COMPLETE` - Charging session completed
- `SHIPMENT_ASSIGNED` - Shipment assigned to truck
- `SHIPMENT_IN_TRANSIT` - Shipment started transit
- `SHIPMENT_DELIVERED` - Shipment delivered
- `DRIVER_ASSIGNED` - Driver assigned to truck
- `DRIVER_DETACHED` - Driver detached from truck

**Generation Rules:**
- Generate immediately when event occurs
- Store in database or generate on-demand
- Filter by timestamp for "recent" events (last 24 hours)

---

## 6. Dashboard Synchronization Rules

### 6.1 Single Source of Truth

**Principle:** All dashboard summary endpoints must derive from the same underlying simulation state and transactions.

**Enforcement:**
- No dashboard-specific fake counters
- All KPIs must be derived from actual database records
- All aggregations must use SQL queries on real tables
- No hardcoded values in dashboard routes

---

### 6.2 Deterministic Aggregate State

**Rule:** All KPIs must be calculated deterministically from database state.

**Examples:**
- "Swaps Today" = `COUNT(*) FROM swap_transactions WHERE date(timestamp) = date('now')`
- "Active Trucks" = `COUNT(*) FROM trucks WHERE status IN ('READY', 'IN_TRANSIT')`
- "Revenue Today" = `SUM(total) FROM receipts WHERE date(timestamp) = date('now')`

**Forbidden:**
- Incrementing counters in memory
- Dashboard-specific state variables
- Fake/placeholder values

---

### 6.3 Timeframe Filtering

**Rule:** All time-based KPIs must support timeframe filtering (daily/monthly/yearly).

**Implementation:**
- Use SQL `date()` and `strftime()` functions
- Filter by `date(timestamp, 'localtime') = date('now', 'localtime')` for daily
- Filter by `strftime('%Y-%m', timestamp, 'localtime') = strftime('%Y-%m', 'now', 'localtime')` for monthly
- Filter by `strftime('%Y', timestamp, 'localtime') = strftime('%Y', 'now', 'localtime')` for yearly

---

### 6.4 Real-time Updates

**Rule:** Dashboard data must reflect simulation state within one refresh cycle.

**Implementation:**
- Simulation updates database every 10 seconds
- Dashboards poll every 10-12 seconds
- WebSocket updates (if configured) push changes immediately

---

## 7. Visibility Rules

### 7.1 A2 HQ Dashboard

**Role:** `ADMIN`, `A2_OPERATOR`

**Can See:**
- ✅ All stations
- ✅ All trucks
- ✅ All drivers
- ✅ All batteries
- ✅ All shipments
- ✅ All swaps
- ✅ All receipts
- ✅ All charging sessions
- ✅ All incidents
- ✅ All charger faults
- ✅ All queue entries
- ✅ All live activity events

**Cannot See:**
- ❌ Nothing (full system access)

---

### 7.2 Fleet Dashboard

**Role:** `FLEET_OWNER` (scoped to `organizationId = fleetId`)

**Can See:**
- ✅ Own fleet's trucks (`fleetId = organizationId`)
- ✅ Own fleet's drivers (`fleetId = organizationId`)
- ✅ Own fleet's shipments (via truck `fleetId`)
- ✅ Own fleet's swaps (via truck `fleetId`)
- ✅ Own fleet's receipts (via truck `fleetId`)
- ✅ All stations (for location context)
- ✅ All batteries (for battery ID lookup)

**Cannot See:**
- ❌ Other fleets' trucks
- ❌ Other fleets' drivers
- ❌ Other fleets' shipments
- ❌ Other fleets' financial data

---

### 7.3 Station Dashboard

**Role:** `STATION_OPERATOR` (scoped to `organizationId = stationId`)

**Can See:**
- ✅ Own station's batteries (`stationId = organizationId`)
- ✅ Own station's swaps (`stationId = organizationId`)
- ✅ Own station's receipts (via swap `stationId`)
- ✅ Own station's charging sessions (`stationId = organizationId`)
- ✅ Own station's incidents (`stationId = organizationId`)
- ✅ Own station's charger faults (`stationId = organizationId`)
- ✅ Own station's queue entries (`stationId = organizationId`)
- ✅ Trucks at own station (`currentStationId = organizationId`)
- ✅ All stations (for map context)
- ✅ All trucks (for incoming predictions)

**Cannot See:**
- ❌ Other stations' detailed data
- ❌ Other stations' revenue
- ❌ Other stations' internal operations

---

### 7.4 Driver Dashboard

**Role:** `DRIVER` (scoped to `organizationId = driverId`)

**Can See:**
- ✅ Own driver profile (`id = organizationId`)
- ✅ Own assigned truck (via `assignedTruckId`)
- ✅ Own shipments (`driverId = organizationId`)
- ✅ Own swap history (via assigned truck)
- ✅ All stations (for navigation)
- ✅ All trucks (for map visualization)
- ✅ All batteries (for map visualization)

**Cannot See:**
- ❌ Other drivers' data
- ❌ Other trucks' details
- ❌ Fleet financial data
- ❌ Station internal operations

---

### 7.5 Freight Dashboard

**Role:** `FREIGHT_CUSTOMER` (scoped to `customerId = user.organizationId`)

**Can See:**
- ✅ Own shipments (`customerId = organizationId`)
- ✅ Assigned truck/driver for own shipments
- ✅ All stations (for booking)
- ✅ Available trucks (for booking, but not other customers' shipments)
- ✅ All batteries (for context)

**Cannot See:**
- ❌ Other customers' shipments
- ❌ Fleet financial data
- ❌ Station internal operations
- ❌ Driver details (except assigned driver for own shipments)

---

### 7.6 EEU Dashboard

**Role:** `EEU_OPERATOR`, `ADMIN`, `A2_OPERATOR`

**Can See:**
- ✅ All stations' energy consumption
- ✅ All stations' charging activity
- ✅ All stations' power draw
- ✅ Network-wide energy totals
- ✅ EEU revenue share
- ✅ Tariff information
- ✅ All stations (for map visualization)
- ✅ All trucks (for map visualization)
- ✅ All batteries (for map visualization)

**Cannot See:**
- ❌ Individual truck details
- ❌ Driver information
- ❌ Customer shipments
- ❌ Station revenue (only energy data)
- ❌ A2 share (only EEU share)

---

## 8. Implementation Requirements

### 8.1 Simulation Cycle Guarantees

**Every cycle (10 seconds), the simulation MUST:**
1. Update truck locations (if in transit)
2. Drain truck SOC (if in transit)
3. Process swaps (if trucks arrive at stations)
4. Process charging (if in charging window)
5. Update driver assignments (60-70% assignment rate)
6. Generate driver telemetry
7. Process freight pipeline (create/transition shipments)
8. Generate incidents (if conditions met)
9. Generate charger faults (1-2% chance per charger)
10. Update queue entries (create/remove)
11. Generate live activity events

---

### 8.2 Data Consistency Guarantees

**The simulation MUST ensure:**
- Battery `stationId` and `truckId` are mutually exclusive
- Truck `currentStationId` is null when `status = IN_TRANSIT`
- Truck `currentStationId` is set when `status = READY` at station
- Driver `assignedTruckId` matches truck `assignedDriverId` (bidirectional)
- Receipt exists for every swap transaction
- Charging session exists for every battery with `status = CHARGING`
- Queue entry exists when truck needs swap and is heading to station

---

### 8.3 KPI Calculation Guarantees

**All KPIs MUST:**
- Be calculated from actual database records
- Support timeframe filtering (daily/monthly/yearly)
- Use consistent date filtering (`date('now', 'localtime')`)
- Round to appropriate decimal places (2 for currency, 1 for percentages)
- Handle null/empty cases gracefully (return 0, not null)

---

## End of Contract

This contract defines the canonical specification for the A2 Corridor simulation. All simulation implementations must adhere to these rules to ensure dashboard synchronization and data consistency.
