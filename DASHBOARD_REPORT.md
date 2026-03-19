# A2 Corridor Dashboard Comprehensive Report

## Executive Summary

This document provides a complete inventory of all dashboards in the A2 Corridor system, including their display components, tabs, KPIs, graphs, lists, and data visibility rules. This report is intended to help improve simulation accuracy by understanding what data each dashboard consumes and displays.

---

## 1. A2 HQ / Network Operations Dashboard

**Route:** `/a2`  
**Roles:** `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **FULL SYSTEM ACCESS** - Can see all stations, trucks, drivers, batteries, shipments, swaps, and financial data across the entire network.

### Tabs

1. **Overview Tab** (Default)
2. **Batteries Tab**
3. **Freight Tab**
4. **System Health Tab**

### Overview Tab Components

#### KPIs (10 cards)
1. **Active Trucks** - Count of trucks with status `READY` or `IN_TRANSIT`
2. **Swaps Today** - Total swap transactions for current day
3. **Batteries Ready** - Count of batteries with status `READY`
4. **Charging Active** - Active charging sessions count
5. **Corridor Energy Today (kWh/day)** - Total energy consumed across all stations today
6. **Corridor Revenue** - Total revenue from all swaps (ETB)
7. **A2 Share** - A2's revenue share (ETB)
8. **EEU Share** - EEU's revenue share (ETB)
9. **VAT Collected** - Total VAT collected (ETB)
10. **Stations Online** - Count of stations with status `ACTIVE`

#### Visual Components
1. **Real-time Network Map Panel** - `OperationsCorridorMap` showing all stations, trucks, and batteries
2. **Live Swap Activity Feed** - Real-time list of swap events
3. **Driver / Truck Assignments (Live Sync)** - List of active driver-truck pairings (top 10)
4. **Station Utilization Overview** - Chart placeholder (not implemented)
5. **Battery Inventory Across Stations** - Chart placeholder (not implemented)
6. **Corridor Charging Activity** - Chart placeholder (not implemented)
7. **Truck Movement Summary** - Trend card placeholder (not implemented)
8. **Queue and Congestion Alerts** - List of incidents/queue alerts
9. **Operational Incidents Feed** - List of operational incidents
10. **Power Consumption by Station** - Table showing:
    - Station name
    - Energy (kWh/day)
    - Revenue (ETB)
    - Utilization (%)
    - Ready batteries count
    - Queue count
11. **Revenue Summary Panel** - Cards showing:
    - Total Corridor Revenue
    - A2 Share
    - EEU Share
12. **A2 Live Feed Panel** - Recent activity feed (last 6 events)

### Batteries Tab

**Table Columns:**
- Battery ID (BAT-######)
- Status (READY, CHARGING, IN_TRUCK, MAINTENANCE)
- SOC (%)
- Health (%)
- Cycle Count
- Location Type (Station/Truck)
- Location Name
- Temperature (°C)
- Capacity (kWh) - **Currently 588 kWh**

**Filters:**
- Search by battery ID
- Filter by status (ALL, READY, CHARGING, IN_TRUCK, MAINTENANCE)

### Freight Tab

**Table Columns:**
- Shipment ID
- Customer ID
- Pickup Location
- Delivery Location
- Cargo Description
- Status (REQUESTED, ASSIGNED, IN_TRANSIT, DELIVERED)
- Assigned Truck (license plate)
- Assigned Driver (name)
- Refrigerated (Yes/No)
- Assigned At (timestamp)

**Filters:**
- Filter by status (ALL, REQUESTED, ASSIGNED, IN_TRANSIT, DELIVERED)

### System Health Tab

#### KPIs (8 cards)
1. **Stations Online** - Count of active stations
2. **Stations Offline** - Count of inactive stations
3. **Trucks Active** - Count of active trucks
4. **Trucks Idle** - Count of idle trucks
5. **Trucks Maintenance** - Count of trucks in maintenance
6. **Drivers Active** - Count of active drivers
7. **Drivers Inactive** - Count of inactive drivers
8. **Network Utilization** - Overall network utilization percentage

#### Components
1. **Alert Summary** - Critical and warning alerts count
2. **Performance Metrics** - Average swap time and charging time
3. **Station Health Grid** - Table showing:
    - Station Name
    - Status
    - Batteries Ready
    - Charging count
    - Queue Size

### Data Sources
- `GET /dashboard/a2` - A2 summary
- `GET /dashboard/a2/live-feed` - Live activity feed
- `GET /billing/summary/a2` - A2 billing summary
- `GET /billing/summary/stations` - Station billing summaries
- `GET /stations` - All stations
- `GET /trucks` - All trucks
- `GET /drivers` - All drivers
- `GET /batteries` - All batteries
- `GET /shipments` - All shipments
- `GET /swaps` - All swaps

### Refresh Rate
- Polling: 10 seconds (when live updates enabled)
- WebSocket: Real-time updates (if configured)

---

## 2. Fleet Dashboard

**Route:** `/fleet`  
**Roles:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **FLEET-SCOPED** - Can only see trucks, drivers, and shipments belonging to their fleet (`organizationId = fleetId`). Can see all stations and batteries for context.

### Tabs

1. **Trucks Tab** (Default)
2. **Drivers Tab**

### KPIs (8 cards)
1. **Active Trucks** - Fleet trucks with status `READY` or `IN_TRANSIT`
2. **Available Trucks** - Fleet trucks with availability `AVAILABLE`
3. **Active Drivers** - Fleet drivers with status `ACTIVE`
4. **Swaps Today** - Swaps for fleet trucks today
5. **Fleet Energy Cost** - Energy cost for fleet (ETB)
6. **Completed Trips** - Delivered shipments for fleet
7. **Maintenance Alerts** - Trucks in maintenance or low SOC
8. **Refrigerated Active** - Active refrigerated trucks count

### Trucks Tab

**Table Columns:**
- License Plate
- Location (station name or coordinates)
- Battery ID
- Driver (name or "Unassigned")
- Status (READY, IN_TRANSIT, MAINTENANCE, IDLE)
- Type (STANDARD, REFRIGERATED)
- SOC (%)
- Last Swap (station name and date)
- Swaps (count today)
- Energy Today (kWh)

**Filters:**
- Search by license plate
- Filter by truck type (ALL, STANDARD, REFRIGERATED)
- Filter by driver (ALL, or specific driver)
- Filter by availability (ALL, AVAILABLE, ACTIVE, IDLE, MAINTENANCE)

**Detail Drawer:**
- License Plate
- Location
- Battery ID
- Assigned Driver
- Status
- Availability
- SOC
- Truck Type
- Last Swap (station and timestamp)

### Drivers Tab

**Table Columns:**
- Driver Name
- Phone
- Rating (★)
- Status (AVAILABLE, ON_DUTY, RESTING, ACTIVE)
- Assigned Truck (license plate with attachment status)
- Truck Location
- Battery ID
- Last Swap (station and date)
- Safety Score (with violations count)
- Actions (Assign/Reassign/Unassign buttons)

**Driver Assignment Controls:**
- Dropdown to select available truck
- Assign/Reassign button
- Unassign button
- Shows "✓ Attached" when both driver and truck are linked
- Shows "⏳ Pending Attachment" when only one side is assigned

### Additional Components

1. **Fleet Corridor Activity Map** - `OperationsCorridorMap` showing all stations and fleet trucks
2. **Driver Assignments** - Scrollable list (max-height 400px) showing:
    - Driver name and status
    - Assigned truck with attachment status
    - Truck location
    - Assignment controls
    - Recent assignment notifications
3. **Energy Usage by Truck** - Chart placeholder (not implemented)
4. **Swap Activity by Truck** - List of top 8 trucks with swap counts
5. **Trips Completed** - Count of delivered shipments
6. **Truck Utilization Panel** - SOC progress bars for top 7 trucks
7. **Maintenance Alerts** - List of trucks needing maintenance (max 8)
8. **Driver Performance Ranking** - Top 8 drivers by rating + safety score
9. **Refrigerated Truck Analytics** - List of refrigerated trucks with temperature info
10. **Fleet Billing Summary** - Cards showing:
    - Energy Cost (ETB)
    - Swaps Today
    - Completed Trips

### Data Sources
- `GET /fleets` - All fleets
- `GET /dashboard/fleet/:id` - Fleet summary
- `GET /trucks` - All trucks (filtered by `fleetId`)
- `GET /drivers` - All drivers (filtered by `fleetId`)
- `GET /batteries` - All batteries (for truck battery IDs)
- `GET /swaps` - All swaps (filtered by fleet trucks)
- `GET /shipments` - All shipments (filtered by fleet trucks)
- `GET /billing/summary/fleets` - Fleet billing summary
- `GET /stations` - All stations (for location context)

### Refresh Rate
- Polling: 12 seconds (when live updates enabled)

### Data Transparency
- **Can see:** Own fleet's trucks, drivers, shipments, swaps, billing
- **Can see:** All stations (for location context)
- **Can see:** All batteries (for battery ID lookup)
- **Cannot see:** Other fleets' trucks, drivers, or financial data
- **Can modify:** Driver-truck assignments within own fleet

---

## 3. Station Dashboard

**Route:** `/station`  
**Roles:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **STATION-SCOPED** - Can only see data for their assigned station (`organizationId = stationId`). Can see all stations and trucks for context.

### KPIs (9 cards)
1. **Total Batteries** - Batteries at station
2. **Ready Batteries** - Batteries with status `READY`
3. **Charging Batteries** - Batteries with status `CHARGING`
4. **Trucks at Station** - Trucks with `currentStationId = stationId`
5. **Swaps Today** - Swaps at station today
6. **Energy Consumed Today** - Energy consumed at station (kWh)
7. **Energy Charging Now** - Current charging energy (kWh)
8. **Revenue Today** - Revenue from swaps today (ETB)
9. **Revenue This Month** - Revenue from swaps this month (ETB)
10. **Charger Faults Open** - Open charger fault count
11. **Queue Size** - Trucks in queue at station

### Components

1. **Station Overview Card** - `OperationsCorridorMap` showing all stations with highlighted selected station
2. **Battery Charging Visualization** - Grid of 100 batteries showing:
    - Color-coded by status (READY=green, CHARGING=amber, IN_TRUCK=cyan)
    - SOC progress bars
    - Battery IDs
3. **Swap Payment Notifications** - Real-time toast notifications for swap payments
4. **Station Activity Map** - Top-down view showing:
    - Battery charging slots (100 slots)
    - Truck parking bays (2-4 bays)
    - Swap stations (2-4 bays with real-time swap activity)
    - Power flow indicators (input/output)
    - Room temperature display
5. **Station Data Grids** - Multiple tables:
    - **Battery Inventory Table:**
        - Battery ID
        - Status
        - SOC (%)
        - Health (%)
        - Cycle Count
        - Temperature (°C)
        - Capacity (kWh)
    - **Charging Sessions Table:**
        - Battery ID
        - Start Time
        - Current SOC (%)
        - Target SOC (%)
        - Energy Added (kWh)
        - Estimated Completion
    - **Recent Swaps Table:**
        - Swap ID
        - Truck ID
        - Incoming Battery ID
        - Outgoing Battery ID
        - Energy Delivered (kWh)
        - Timestamp
    - **Trucks at Station Table:**
        - License Plate
        - Status
        - SOC (%)
        - Battery ID
        - Arrival Time
    - **Incoming Predictions Table:**
        - Truck Label (license plate)
        - ETA
        - Estimated SOC (%)
        - Distance (km)
    - **Charger Status Table:**
        - Charger ID
        - Status (ACTIVE, READY, FAULT)
        - Output (kW)
        - Battery ID (if charging)
    - **Incidents Table:**
        - Incident ID
        - Type
        - Severity
        - Description
        - Timestamp
    - **Charger Faults Table:**
        - Fault ID
        - Charger ID
        - Error Code
        - Description
        - Status
        - Reported At

### Filters
- Station selector (dropdown)
- Battery status filter (ALL, READY, CHARGING, IN_TRUCK, MAINTENANCE)
- Charger status filter (ALL, ACTIVE, READY, FAULT)
- Station search

### Data Sources
- `GET /stations` - All stations
- `GET /dashboard/station/:id` - Station summary (includes revenue, energy, queue, charger status, incoming predictions)
- `GET /batteries` - All batteries (filtered by `stationId`)
- `GET /swaps` - All swaps (filtered by `stationId`)
- `GET /trucks` - All trucks (filtered by `currentStationId`)
- `GET /stations/:id/incidents` - Station incidents
- `GET /stations/:id/charger-faults` - Charger faults
- `GET /charging/station/:id` - Charging sessions

### Refresh Rate
- Polling: 12 seconds (when live updates enabled)

### Data Transparency
- **Can see:** Own station's batteries, swaps, trucks, incidents, charger faults, charging sessions, revenue, energy
- **Can see:** All stations (for map context)
- **Can see:** All trucks (for incoming predictions and map)
- **Cannot see:** Other stations' detailed data, revenue, or internal operations
- **Can modify:** None (read-only dashboard)

---

## 4. Driver Dashboard

**Route:** `/driver`  
**Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **DRIVER-SCOPED** - Can only see their own profile and assigned truck data (`organizationId = driverId`). Can see all stations for navigation.

### Components

1. **Driver Profile / Truck Link** - Card showing:
    - Driver name
    - Attached license plate (prominent display)
    - Input field for license plate/code
    - QR scan stub button
    - Attach/Detach buttons

2. **KPIs (6 cards):**
    - **Current SOC** - Battery state of charge (%)
    - **Remaining Range** - Estimated range in km (SOC × 3.2)
    - **Assigned Truck** - License plate or "Unassigned"
    - **Next Destination** - Delivery location from active shipment
    - **Nearest Station** - Closest station name
    - **Estimated Wait** - Estimated wait time at nearest station

3. **My Truck Summary** - Card showing:
    - License plate
    - Status
    - SOC (%)
    - Temperature (°C)

4. **Battery Level & Range** - Card with:
    - Large SOC display
    - Range in km
    - SOC progress bar

5. **Nearest Stations (Battery Availability)** - List of top 4 nearest stations showing:
    - Station name
    - Ready batteries count
    - Queue size
    - Distance (km)
    - ETA (minutes)
    - "Recommended" badge for closest station

6. **Trip Instructions** - Static instructions card

7. **Freight Assignment** - Card showing:
    - Shipment ID (FRT-###)
    - Status badge
    - Pickup location
    - Delivery location
    - ETA

8. **Navigation / Route Map** - `OperationsCorridorMap` with:
    - All stations
    - All trucks
    - Highlighted nearest station
    - Current route display

9. **Swap History** - List of recent swaps (max 8) showing:
    - Swap ID
    - Station ID
    - Energy delivered (kWh)

10. **Driving Activity Log** - List of recent activities (max 8)

11. **Safety / Performance** - Card showing:
    - Safety Score
    - Warnings (speed violations, harsh brakes)

12. **Refrigeration Status** (if truck is refrigerated):
    - Target Temperature (°C)
    - Current Temperature (°C)
    - Power Draw (kW)

### Filters
- Driver selector (only visible for non-DRIVER roles)
- Live refresh indicator

### Data Sources
- `GET /drivers/:id` - Driver profile
- `GET /dashboard/driver/:id` - Driver dashboard summary
- `GET /trucks/:id` - Assigned truck details
- `GET /shipments` - All shipments (filtered by `driverId`)
- `GET /swaps` - All swaps (filtered by assigned truck)
- `GET /stations` - All stations (for navigation)
- `GET /trucks` - All trucks (for map)
- `GET /batteries` - All batteries (for station battery counts)

### Refresh Rate
- Polling: 12 seconds (when live updates enabled)

### Data Transparency
- **Can see:** Own driver profile, assigned truck, own shipments, own swap history
- **Can see:** All stations (for navigation and battery availability)
- **Can see:** All trucks and batteries (for map visualization only)
- **Cannot see:** Other drivers' data, other trucks' details, fleet financial data
- **Can modify:** Attach/detach to trucks (via license plate or QR code)

---

## 5. Freight Dashboard

**Route:** `/freight`  
**Roles:** `FREIGHT_CUSTOMER`, `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **CUSTOMER-SCOPED** - Can only see shipments where `customerId = user.organizationId`. Can see all stations, trucks, and drivers for booking context.

### KPIs (6 cards) - Timeframe Selectable (Daily/Monthly/Yearly)
1. **Total Shipments** - Count of shipments in selected timeframe
2. **Active Shipments** - Count of shipments with status `ASSIGNED` or `IN_TRANSIT`
3. **Delivered Shipments** - Count of shipments with status `DELIVERED`
4. **Estimated Spend** - Total estimated spend (ETB)
5. **Refrigerated Shipments** - Count of refrigerated shipments
6. **Pending Delivery Confirmations** - Count of delivered but unconfirmed shipments

### Components

1. **New Freight Booking Form:**
    - Pickup Station (dropdown - 7 corridor stations + fleet stations)
    - Delivery Station (dropdown - 7 corridor stations + fleet stations)
    - Cargo Description (textarea, 500 char max)
    - Weight (tonnes)
    - Volume (m³)
    - Pickup Time Window
    - Requires Refrigeration (checkbox)
    - Temperature Target (°C, if refrigerated)
    - Estimated Freight Price (ETB)
    - Submit Booking button

2. **Available Trucks Near Pickup:**
    - List of available trucks ranked by:
        - Distance from pickup location (ascending)
        - SOC (descending)
    - Shows for each truck:
        - License Plate
        - Location (station name or coordinates, with "simulated" label if needed)
        - Distance from pickup (km)
        - SOC (%)
        - Truck Type
        - "Top Match" badge for best-ranked truck

3. **Assigned Truck & Driver:**
    - Shipment ID
    - Assigned truck license plate
    - Assigned driver name
    - Status badge

4. **Shipment Tracking Map:**
    - `OperationsCorridorMap` showing all stations and trucks
    - Route display (pickup → delivery)

5. **Delivery Timeline:**
    - Timeline of shipment events:
        - Requested
        - Assigned
        - Pickup Confirmed
        - In Transit
        - Delivered
    - Status indicators (done/active/pending)
    - Timestamps

6. **Delivery Confirmation Records:**
    - List of confirmed deliveries (max 8) showing:
        - Shipment ID
        - Confirmation timestamp

7. **Shipment History Table:**
    - Shipment ID
    - Route (pickup → delivery)
    - Cargo Description
    - Status
    - Refrigerated (Yes/No)
    - Weight (tonnes)
    - Volume (m³)

8. **Refrigerated Shipment Controls** (if applicable):
    - Temperature Target (°C)
    - Current Cargo Mode
    - Monitoring Status

### Filters
- Shipment selector (dropdown)
- KPI Timeframe selector (Daily/Monthly/Yearly)
- Live refresh indicator

### Data Sources
- `GET /shipments` - All shipments (filtered by `customerId`)
- `GET /dashboard/freight/:customerId?timeframe=...` - Freight summary
- `GET /trucks` - All trucks (for available trucks list)
- `GET /drivers` - All drivers (for assigned driver lookup)
- `GET /stations` - All stations (for pickup/delivery selection)
- `GET /batteries` - All batteries (for truck battery context)
- `GET /freight/:id` - Shipment details
- `GET /freight/:id/tracking` - Shipment tracking events

### Refresh Rate
- Polling: 12 seconds (always enabled)

### Data Transparency
- **Can see:** Own shipments (where `customerId = user.organizationId`)
- **Can see:** All stations (for booking)
- **Can see:** Available trucks (for booking, but not other customers' shipments)
- **Can see:** Assigned drivers (for own shipments only)
- **Cannot see:** Other customers' shipments, fleet financial data, station internal operations
- **Can modify:** Create new shipment requests (with immediate assignment requirement)

---

## 6. EEU Dashboard

**Route:** `/eeu`  
**Roles:** `EEU_OPERATOR`, `ADMIN`, `A2_OPERATOR`  
**Data Scope:** **NETWORK-WIDE ENERGY DATA** - Can see all stations' energy consumption, charging activity, and EEU revenue share. Cannot see individual truck/driver details or customer shipments.

### KPIs (7 cards) - Timeframe Selectable (Daily/Monthly/Yearly)
1. **Total Network Load (kW, live)** - Current total power draw across all stations
2. **Station Energy (kWh/{timeframe})** - Total energy consumed in timeframe
3. **Electricity Delivered ({timeframe})** - Total electricity delivered value (ETB)
4. **EEU Revenue Share ({timeframe})** - EEU's revenue share (ETB)
5. **Active Charging Sessions** - Count of active charging sessions
6. **Peak Load Station** - Station name with highest current load
7. **Forecast Load (24h)** - Forecasted load for next 24 hours (kW)

### Components

1. **Real-time Network Load Overview:**
    - `OperationsCorridorMap` showing all stations and trucks
    - Current load display
    - Grid capacity indicator (64%)
    - Peak threshold monitoring badge

2. **Electricity Demand by Station (Today):**
    - List of top 10 stations showing:
        - Station name
        - Live load (kW, current)
        - Progress bar for utilization

3. **Charger Power Draw Panel (Now):**
    - List of top 10 stations showing:
        - Station name
        - Active chargers count

4. **Grid Capacity Utilization** - Chart placeholder (not implemented)

5. **24-hour Load Forecast** - Chart placeholder (not implemented)

6. **Station-level Power Table:**
    - Station name
    - Live Load (kW, current)
    - Energy (kWh/{timeframe})
    - Active Chargers
    - Utilization (%)

7. **Power Interruptions / Notices:**
    - List of grid notices showing:
        - Title
        - Severity badge
        - Detail description

8. **EEU Finance Summary ({timeframe}):**
    - Total Energy Delivered (kWh)
    - EEU Revenue Share (ETB)
    - VAT Share (ETB)
    - Total Transactions (count)
    - Avg Energy per Transaction (kWh)
    - Current Tariff (ETB/kWh)

### Filters
- Timeframe selector (Daily/Monthly/Yearly)
- Live refresh indicator

### Data Sources
- `GET /dashboard/eeu?timeframe=...` - EEU dashboard summary
- `GET /billing/summary/eeu?timeframe=...` - EEU billing summary
- `GET /config/tariffs` - Tariff configuration
- `GET /stations` - All stations
- `GET /trucks` - All trucks (for map visualization)
- `GET /batteries` - All batteries (for map visualization)
- `GET /charging/station/:id` - Charging sessions per station

### Refresh Rate
- Polling: 10 seconds (when live updates enabled)
- WebSocket: Real-time updates (if configured)

### Data Transparency
- **Can see:** All stations' energy consumption, charging activity, power draw, utilization
- **Can see:** Network-wide energy totals, EEU revenue share, tariff information
- **Can see:** All stations and trucks (for map visualization only)
- **Cannot see:** Individual truck details, driver information, customer shipments, station revenue (only energy data)
- **Can modify:** None (read-only dashboard)

---

## Data Transparency Matrix

| Dashboard | Stations | Trucks | Drivers | Batteries | Shipments | Swaps | Revenue | Energy | Other Fleets |
|-----------|----------|--------|---------|-----------|-----------|-------|---------|--------|--------------|
| **A2 HQ** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Fleet** | ✅ All (context) | ✅ Own only | ✅ Own only | ✅ All (lookup) | ✅ Own only | ✅ Own only | ✅ Own only | ❌ | ❌ |
| **Station** | ✅ All (context) | ✅ All (context) | ❌ | ✅ Own only | ❌ | ✅ Own only | ✅ Own only | ✅ Own only | ❌ |
| **Driver** | ✅ All (nav) | ✅ All (map) | ✅ Own only | ✅ All (map) | ✅ Own only | ✅ Own only | ❌ | ❌ | ❌ |
| **Freight** | ✅ All (booking) | ✅ Available (booking) | ✅ Assigned (own) | ✅ All (context) | ✅ Own only | ❌ | ❌ | ❌ | ❌ |
| **EEU** | ✅ All (energy) | ✅ All (map) | ❌ | ✅ All (map) | ❌ | ❌ | ✅ EEU share only | ✅ All | ❌ |

**Legend:**
- ✅ = Can see (with scope limitations noted)
- ❌ = Cannot see

---

## Simulation Data Requirements

To make the simulation more accurate, ensure the following data is being generated and updated:

### Core Entities
1. **Trucks:**
    - `locationLat`, `locationLng` - Continuous updates during transit
    - `currentStationId` - Updated on arrival/departure
    - `currentSoc` - Drains during transit, refills on swap
    - `assignedDriverId` - Links to driver
    - `batteryId` - Current battery in truck
    - `status` - READY, IN_TRANSIT, MAINTENANCE, IDLE
    - `availability` - AVAILABLE, ACTIVE, IDLE

2. **Drivers:**
    - `assignedTruckId` - Links to truck
    - `status` - AVAILABLE, ON_DUTY, RESTING, ACTIVE
    - `safetyScore`, `speedViolations`, `harshBrakes` - Performance metrics

3. **Batteries:**
    - `capacityKwh` - **588 kWh** (standardized)
    - `soc` - State of charge (0-100%)
    - `status` - READY, CHARGING, IN_TRUCK, MAINTENANCE
    - `stationId` - Current station (null if in truck)
    - `truckId` - Current truck (null if at station)
    - `health`, `cycleCount`, `temperature` - Health metrics

4. **Stations:**
    - `locationLat`, `locationLng` - Station coordinates
    - `status` - ACTIVE, INACTIVE
    - `capacity` - Station capacity

5. **Swaps:**
    - `truckId`, `stationId` - Swap participants
    - `incomingBatteryId`, `outgoingBatteryId` - Battery IDs
    - `energyDeliveredKwh` - Energy delivered
    - `timestamp` - Swap time

6. **Shipments:**
    - `pickupLat`, `pickupLng`, `deliveryLat`, `deliveryLng` - Coordinates
    - `truckId`, `driverId` - Assignment (immediate on creation)
    - `status` - REQUESTED, ASSIGNED, IN_TRANSIT, DELIVERED
    - `customerId` - Customer ownership

7. **Charging Sessions:**
    - `batteryId`, `stationId` - Session participants
    - `startSoc`, `currentSoc`, `targetSoc` - SOC progression
    - `energyAddedKwh` - Energy added
    - `startTime`, `estimatedCompletion` - Timing

8. **Receipts:**
    - `swapTransactionId` - Linked swap
    - `totalAmountEtb` - Payment amount
    - `paymentMethod` - Payment method
    - `timestamp` - Payment time

### Financial Data
1. **Revenue:**
    - Per-station revenue (from receipts)
    - Per-fleet energy costs (from receipts)
    - A2 share, EEU share, VAT (calculated from receipts)

2. **Energy:**
    - Per-station energy consumption (from charging sessions)
    - Per-battery energy added (from charging sessions)
    - Network-wide totals

### Queue Data
1. **Swap Queue:**
    - `truckId`, `stationId` - Queue entry
    - `bookedAt` - Booking time
    - Distance-based ordering

### Real-time Updates
- Truck location updates (every simulation cycle)
- SOC drain during transit
- Charging progress updates
- Swap completion events
- Driver-truck assignment changes
- Shipment status transitions

---

## Recommendations for Simulation Accuracy

1. **Battery Capacity:** Ensure all batteries use **588 kWh** capacity consistently.

2. **Truck Movement:** 
    - Update `locationLat`/`locationLng` continuously during transit
    - Update `currentStationId` on arrival/departure
    - Drain SOC based on distance traveled

3. **Charging:**
    - Respect charging windows (typically 22:00-06:00)
    - Update `currentSoc` in charging sessions
    - Create charging sessions for batteries below threshold

4. **Swaps:**
    - Create receipts for every swap
    - Update battery assignments (`stationId`/`truckId`)
    - Update truck `batteryId`
    - Calculate `energyDeliveredKwh` correctly

5. **Driver Assignments:**
    - Maintain 60-70% assignment rate (not all drivers assigned)
    - Occasional detachments (5-10% per cycle)
    - New assignments (5-10% per cycle)

6. **Shipments:**
    - Immediate assignment on creation (or reject if no eligible truck/driver)
    - Update status transitions (REQUESTED → ASSIGNED → IN_TRANSIT → DELIVERED)
    - Complete 3 shipments per cycle

7. **Revenue:**
    - Generate receipts for all swaps
    - Calculate A2 share, EEU share, VAT correctly
    - Update per-station and per-fleet totals

8. **Queue:**
    - Add trucks to queue when booking swap
    - Order by distance from station
    - Update queue size in station summary

---

## End of Report

This report provides a complete inventory of all dashboards, their components, data sources, and visibility rules. Use this information to ensure the simulation generates and updates all required data accurately.
