# A2 Corridor Backend API Documentation

Base URL: `http://localhost:3000`

## Quick Start

- Install deps: `npm install`
- Run API: `npm run dev`
- Build: `npm run build`
- Run tests: `npm test`
- Seed demo data: `npm run seed`

## Authentication

JWT is used for protected routes.

- Header format: `Authorization: Bearer <token>`
- Obtain token from:
  - `POST /auth/register`
  - `POST /auth/login`

## Standard Error Shape

Most validation/business errors return:

```json
{
  "error": "message"
}
```

---

## Health

### GET `/health`
Returns service status.

Response:

```json
{
  "status": "ok",
  "service": "A2 Corridor Backend",
  "time": "2026-03-13T10:00:00.000Z"
}
```

---

## Auth

### POST `/auth/register`
Creates a user and returns JWT.

Body:

```json
{
  "name": "Alice Admin",
  "email": "alice@example.com",
  "password": "secret123",
  "role": "ADMIN",
  "organizationId": "ORG-001"
}
```

Roles:

- `ADMIN`
- `A2_OPERATOR`
- `STATION_OPERATOR`
- `FLEET_OWNER`
- `DRIVER`
- `FREIGHT_CUSTOMER`
- `EEU_OPERATOR`

### POST `/auth/login`
Logs in user and returns JWT.

Body:

```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

### GET `/auth/me`
Protected. Returns current authenticated user.

### GET `/auth/admin-only`
Protected. Requires role `ADMIN`.

---

## Corridor Core Entities

### Stations

#### POST `/stations`
Body:

```json
{
  "name": "Addis Hub",
  "location": "Addis Ababa",
  "capacity": 40,
  "status": "ACTIVE"
}
```

#### GET `/stations`
Returns all stations.

### Fleets

#### POST `/fleets`
Body:

```json
{
  "name": "Selam Transport",
  "ownerName": "Alemu Bekele",
  "region": "Addis Ababa"
}
```

#### GET `/fleets`
Returns all fleets.

### Trucks

`truckType` values:

- `STANDARD`
- `REFRIGERATED`

#### POST `/trucks`

Standard truck body:

```json
{
  "plateNumber": "ET-1001",
  "fleetId": 1,
  "truckType": "STANDARD",
  "batteryId": "BAT-1001",
  "status": "READY",
  "currentSoc": 80,
  "currentStationId": 1
}
```

Refrigerated truck body (extra required fields):

```json
{
  "plateNumber": "ET-1002",
  "fleetId": 1,
  "truckType": "REFRIGERATED",
  "batteryId": "BAT-1002",
  "status": "READY",
  "currentSoc": 88,
  "refrigerationPowerDraw": 12,
  "temperatureTarget": 4,
  "temperatureCurrent": 6,
  "currentStationId": 1
}
```

#### GET `/trucks`
Returns all trucks.

#### GET `/trucks/refrigerated`
Returns refrigerated trucks only.

#### PATCH `/trucks/:id/temperature`
Updates refrigerated truck temperature.

Body:

```json
{
  "temperatureCurrent": 3,
  "temperatureTarget": 4
}
```

### Drivers

#### POST `/drivers`
Body:

```json
{
  "name": "Abel Tesfaye",
  "phone": "+251911111111",
  "fleetId": 1,
  "rating": 4.5,
  "status": "AVAILABLE"
}
```

#### GET `/drivers`
Returns all drivers.

#### POST `/drivers/:id/rate`
Stores customer rating and updates driver performance aggregates.

Body:

```json
{
  "customerRating": 5,
  "deliveryFeedback": "positive"
}
```

#### POST `/drivers/:id/telemetry`
Stores telemetry and updates safety score.

Body:

```json
{
  "speed": 110,
  "brakeForce": 0.9,
  "timestamp": "2026-03-13T12:00:00.000Z"
}
```

---

## Batteries

`status` values:

- `READY`
- `CHARGING`
- `IN_TRUCK`
- `MAINTENANCE`

### POST `/batteries`
Body:

```json
{
  "capacityKwh": 300,
  "soc": 90,
  "health": 97,
  "cycleCount": 120,
  "temperature": 28,
  "status": "READY",
  "stationId": 1
}
```

Note: provide either `stationId` or `truckId`, not both.

### GET `/batteries`
Returns all batteries.

### PATCH `/batteries/:id/soc`
Body:

```json
{
  "soc": 55.5
}
```

### PATCH `/batteries/:id/assign-truck`
Body:

```json
{
  "truckId": 1
}
```

### PATCH `/batteries/:id/assign-station`
Body:

```json
{
  "stationId": 1
}
```

---

## Swap Transactions

### POST `/swaps`
Creates a swap transaction, updates battery assignments, and creates billing receipt.

Body:

```json
{
  "truckId": 1,
  "stationId": 1,
  "incomingBatteryId": 2,
  "outgoingBatteryId": 1,
  "arrivalSoc": 20
}
```

Energy includes refrigeration overhead for refrigerated trucks:

- `extraEnergy = refrigerationPowerDraw`

### GET `/swaps`
Returns swap transactions.

---

## Charging

### POST `/charging/start`
Starts charging session.

Body:

```json
{
  "stationId": 1,
  "batteryId": 1
}
```

### POST `/charging/complete`
Completes active session and updates battery SOC.

Body:

```json
{
  "sessionId": 1,
  "endSoc": 90
}
```

### GET `/charging/station/:stationId`
Returns charging sessions for station.

---

## Billing

### GET `/billing/receipts`
Returns all generated receipts.

Billing formula:

- `energyCharge = kwh * 10`
- `serviceCharge = kwh * 10`
- `subtotal = energyCharge + serviceCharge`
- `vat = subtotal * 0.15`
- `total = subtotal + vat`

Revenue split:

- `EEU = energyCharge + 0.5 * vat`
- `A2 = serviceCharge + 0.5 * vat`

---

## Freight

Shipment status values:

- `REQUESTED`
- `ASSIGNED`
- `IN_TRANSIT`
- `DELIVERED`

### POST `/freight/request`
Creates a shipment request.

Body:

```json
{
  "pickupLocation": "Adama",
  "deliveryLocation": "Dire Dawa",
  "cargoDescription": "Medical supplies",
  "weight": 3500,
  "volume": 16,
  "pickupWindow": "2026-03-17T08:00:00.000Z"
}
```

### GET `/freight`
Returns shipments.

### POST `/freight/:id/assign`
Assigns nearest available truck (region match heuristic) and an available fleet driver.

---

## Dashboard Aggregates

### GET `/dashboard/a2`
Returns:

- `activeTrucks`
- `swapsToday`
- `batteriesReady`
- `energyToday`
- `incidents`
- `stationsOnline`

### GET `/dashboard/station/:id`
Station-level metrics:

**Top KPIs:**
- `batteriesAtStation` - Total batteries at station
- `readyBatteries` - Count of READY batteries
- `chargingBatteries` - Count of CHARGING batteries
- `activeChargingSessions` - Count of active charging sessions
- `swapsToday` - Swaps performed today
- `energyToday` - Energy consumed today (kWh)
- `energyChargingNowKwh` - Current power draw from charging (kW)
- `revenueTodayEtb` - Revenue today (ETB)
- `revenueThisMonthEtb` - Revenue this month (ETB)
- `chargerFaultsOpen` - Count of open charger faults
- `queueSize` - Current queue size

**Operational Data:**
- `batteryInventoryByStatus` - Breakdown by status (READY, CHARGING, MAINTENANCE, IN_TRUCK)
- `batteriesReadyForSwap` - List of READY batteries with SOC >= 80%
- `activeChargingSessionsList` - Full list of active sessions with progress details
- `recentCompletedChargingSessions` - Last 10 completed charging sessions
- `recentSwaps` - Last 10 swap transactions
- `trucksCurrentlyAtStation` - List of trucks currently at station
- `chargerStatus` - Charger status array with active/ready states
- `incomingPredictions` - Incoming truck predictions with ETA and estimated SOC

### GET `/dashboard/fleet/:id`
Fleet-level metrics:

- `totalTrucks`
- `activeTrucks`
- `availableDrivers`
- `activeShipments`

### GET `/dashboard/driver/:id`
Driver-level metrics:

- `overallRating`
- `safetyScore`
- `speedViolations`
- `harshBrakes`
- `completedTrips`
- `tripEfficiency`

### GET `/dashboard/eeu`
EEU-level metrics:

- `swapsToday`
- `energySoldToday`
- `revenueToday`
- `vatShareToday`
- `totalShareToday`
- `activeStations`

---

## Simulation

### POST `/simulation/start`
Starts background simulation loop.

Behavior:

- runs every 10 seconds
- moves trucks between stations
- reduces battery SOC (enforced 25% minimum floor)
- triggers swaps when SOC < 35% (always) or SOC < 45% (70% chance)
- creates/advances charging sessions
- **Warm-start**: Demo begins with operational state (batteries charging, trucks present, recent swaps)

### POST `/simulation/stop`
Stops the background simulation loop.

### Simulation Behavior

**Warm-Start State:**
- Demo seeds with 1000 trucks, 1000 drivers, and realistic battery inventory
- Stations begin with operational state:
  - 45% READY batteries (SOC 80-95%)
  - 35% CHARGING batteries (SOC 25-80%) with active charging sessions
  - 15% IN_TRUCK batteries (assigned to trucks)
  - 5% MAINTENANCE batteries
- Historical data seeded: 50-100 swaps today, 20-30 completed charging sessions
- Some trucks positioned at stations (not all in transit)

**25% SOC Minimum Floor:**
- No battery may go below 25% SOC anywhere in the simulation
- Movement phase enforces floor during transit
- Station operations phase clamps arrival SOC to minimum 25%
- Swap trigger logic uses 35% threshold to ensure trucks swap before hitting floor
- All seeded batteries have SOC >= 25%

**Charging Capacity:**
- Scaled for 1000 trucks:
  - Small stations (capacity ≤18): max 50 chargers
  - Medium stations (capacity 19-25): max 100 chargers
  - Large stations (capacity >25): max 150 chargers
- Charger count calculated as: 1 per 3.5 batteries, min 10, max based on station size

---

## Postman Collection

Use `A2_Corridor_Backend.postman_collection.json` at backend root.

- Set `baseUrl` to your running API URL
- Run `Auth > Register` or `Auth > Login` first to populate `authToken`

---

## Operational Gap Completion (Phase 13)

This section documents newly added operational endpoints and extended workflows.

### Role and ownership model

- **System admins:** `ADMIN`, `A2_OPERATOR`
- **Station ownership:** `STATION_OPERATOR` uses `organizationId = stationId`
- **Fleet ownership:** `FLEET_OWNER` uses `organizationId = fleetId`
- **Driver ownership:** `DRIVER` uses `organizationId = driverId`
- **Customer ownership:** `FREIGHT_CUSTOMER` can access shipments where `customerId = user.id`

### 1) A2 HQ / Admin Configuration

#### GET `/config/tariffs`
- **Purpose:** Read global tariff configuration.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Response:**
```json
{
  "tariffs": {
    "eeuRatePerKwh": 10,
    "a2ServiceRatePerKwh": 10,
    "vatPercent": 15
  }
}
```

#### PATCH `/config/tariffs`
- **Purpose:** Update global tariff configuration.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "eeuRatePerKwh": 12,
  "a2ServiceRatePerKwh": 13,
  "vatPercent": 17
}
```
- **Validation:** all three fields are required.

#### GET `/config/charging-windows`
- **Purpose:** Read charging window config.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Response:**
```json
{
  "chargingWindow": {
    "startHour": 20,
    "endHour": 6,
    "label": "Overnight Window"
  }
}
```

#### PATCH `/config/charging-windows`
- **Purpose:** Update charging window config.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "startHour": 20,
  "endHour": 6,
  "label": "Overnight Window"
}
```
- **Validation:** `startHour` and `endHour` required and each must be between `0` and `23`.

#### PATCH `/stations/:id/config`
- **Purpose:** Update station operational config.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "maxQueueSize": 30,
  "swapBayCount": 4,
  "overnightChargingEnabled": true,
  "incidentThreshold": 8,
  "operatingStatus": "ACTIVE"
}
```
- **Validation:** all fields required; station must exist.

#### GET `/users`
- **Purpose:** List users for administration.
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Response:** `id`, `name`, `email`, `role`, `organizationId`, `createdAt`.

#### PATCH `/users/:id/role`
- **Purpose:** Change user role.
- **Roles:** `ADMIN` only
- **Body:**
```json
{
  "role": "FLEET_OWNER"
}
```
- **Validation:** role must be one of allowed system roles.

### 2) Station Incidents and Charger Faults

#### POST `/stations/:id/incidents`
- **Purpose:** Report station incident.
- **Roles:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "type": "QUEUE",
  "severity": "HIGH",
  "message": "Queue overflow",
  "status": "OPEN"
}
```
- **Validation:** all fields required.
- **Ownership rule:** `STATION_OPERATOR` can only post for own station.

#### GET `/stations/:id/incidents`
- **Purpose:** List station incidents.
- **Roles:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** `STATION_OPERATOR` can only view own station.

#### POST `/stations/:id/charger-faults`
- **Purpose:** Report charger fault.
- **Roles:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "chargerId": "CH-1",
  "faultCode": "E-42",
  "message": "Connector issue",
  "status": "OPEN"
}
```
- **Validation:** all fields required.
- **Ownership rule:** `STATION_OPERATOR` can only post for own station.

#### GET `/stations/:id/charger-faults`
- **Purpose:** List charger faults for station.
- **Roles:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** `STATION_OPERATOR` can only view own station.

### 3) Driver Operational Workflow

#### POST `/drivers/:id/assign-truck`
- **Purpose:** Link driver to truck.
- **Roles:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "truckId": 12
}
```
- **Ownership rule:** `FLEET_OWNER` restricted to own fleet entities.

#### POST `/freight/:id/accept`
- **Purpose:** Driver accepts assigned shipment (`IN_TRANSIT`).
- **Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Validation:** shipment must exist.
- **Ownership rule:** `DRIVER` only for own assigned shipment.

#### POST `/freight/:id/pickup-confirm`
- **Purpose:** Confirm pickup.
- **Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** `DRIVER` only for own assigned shipment.

#### POST `/freight/:id/delivery-confirm`
- **Purpose:** Confirm delivery (`DELIVERED`).
- **Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** `DRIVER` only for own assigned shipment.

#### POST `/drivers/:id/arrive-station`
- **Purpose:** Record arrival event linking driver, truck, station.
- **Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "stationId": 4,
  "truckId": 22
}
```
- **Ownership rule:** `DRIVER` only for own driver profile.

### 4) Fleet Operations Actions

#### POST `/fleets/:id/assign-driver`
- **Purpose:** Assign specific driver to truck within fleet.
- **Roles:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "driverId": 10,
  "truckId": 22
}
```
- **Validation:** all IDs required and must belong to the fleet.

#### PATCH `/trucks/:id/availability`
- **Purpose:** Update truck availability for freight matching.
- **Roles:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "availability": "AVAILABLE"
}
```
- **Ownership rule:** `FLEET_OWNER` only for own fleet trucks.

#### POST `/freight/:id/approve-load`
- **Purpose:** Mark shipment approved for execution.
- **Roles:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** `FLEET_OWNER` only for shipments tied to own fleet.

### 5) Freight Tracking + Refrigeration Support

#### Extended POST `/freight/request`
- **Added fields:**
```json
{
  "requiresRefrigeration": true,
  "temperatureTarget": 4
}
```
- **Behavior:** refrigerate-required loads only match refrigerated trucks during assignment.

#### GET `/freight/:id`
- **Purpose:** Shipment detail.
- **Roles:** `FREIGHT_CUSTOMER`, `FLEET_OWNER`, `A2_OPERATOR`, `ADMIN` (and demo/operator roles).
- **Ownership rules:** customer own shipment only; fleet owner only assigned fleet shipment.

#### GET `/freight/:id/tracking`
- **Purpose:** Tracking timeline + assignment detail.
- **Roles/ownership:** same as shipment detail.
- **Response includes:** timeline, assigned truck, assigned driver, pickup/delivery timestamps.

#### POST `/freight/:id/delivery-confirmation`
- **Purpose:** Customer-side delivery acknowledgement event.
- **Roles:** `FREIGHT_CUSTOMER`, `ADMIN`, `A2_OPERATOR`
- **Ownership rule:** freight customer only for own shipment.

### 6) Finance Summary Endpoints

#### GET `/billing/summary/a2`
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Returns:** `totalReceipts`, `totalEnergyKwh`, `totalRevenueEtb`, `totalVatEtb`, `totalA2ShareEtb`, `totalEeuShareEtb`

#### GET `/billing/summary/eeu`
- **Roles:** `ADMIN`, `EEU_OPERATOR`, `A2_OPERATOR`
- **Returns:** EEU-focused totals (`energyCharge`, VAT totals, shares, etc.)

#### GET `/billing/summary/stations`
- **Roles:** `ADMIN`, `A2_OPERATOR`, `STATION_OPERATOR`
- **Returns:** `revenueByStation[]`
- **Ownership rule:** station operator restricted to own station.

#### GET `/billing/summary/fleets`
- **Roles:** `ADMIN`, `A2_OPERATOR`, `FLEET_OWNER`
- **Returns:** `revenueByFleet[]`
- **Ownership rule:** fleet owner restricted to own fleet.

### 7) Battery Detail + History

#### GET `/batteries/:id`
- **Purpose:** Battery detail + linked truck/station context.

#### GET `/batteries/:id/history`
- **Purpose:** Unified battery lifecycle view.
- **Returns:** `assignmentChanges`, `socUpdates`, `chargingSessions`, `swapParticipation`, `maintenanceEvents`

### 8) Truck + Driver Detail Endpoints

#### GET `/trucks/:id`
- **Purpose:** Truck detail including fleet, assigned driver, current battery, SOC, refrigeration fields.

#### PATCH `/trucks/:id/location`
- **Roles:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "lat": 8.9806,
  "lng": 38.7578,
  "currentStationId": 2
}
```

#### PATCH `/trucks/:id/status`
- **Roles:** `DRIVER`, `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Body:**
```json
{
  "status": "IN_TRANSIT"
}
```

#### GET `/drivers/:id`
- **Purpose:** Driver detail with assigned truck and performance/safety metrics.

### 9) Dashboard Coverage Completion

#### GET `/dashboard/freight/:customerId`
- **Returns:** `totalShipments`, `activeShipments`, `estimatedSpend`, `recentShipmentActivity`, `deliveryConfirmations`

#### GET `/dashboard/a2/live-feed`
- **Returns recent:** swaps, charging starts/completions, incidents, charger faults, freight assignments, truck arrivals

### 10) Demo Utilities

#### POST `/demo/reset`
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Purpose:** clear demo operational data tables.

#### POST `/demo/seed`
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Purpose:** run demo data seeder.
- **Seeds:**
  - 10 fleets
  - 1000 trucks (scaled from 200)
  - 1000 drivers
  - 7 stations
  - Realistic battery inventory with warm-start operational state
  - Historical swaps and charging sessions for today

#### POST `/demo/scenario/:name`
- **Roles:** `ADMIN`, `A2_OPERATOR`
- **Supported names:**
  - `morning-operations`
  - `station-congestion`
  - `charger-fault`
  - `refrigerated-priority-load`

### 11) Postman Sync Notes

The root collection `A2_Corridor_Backend.postman_collection.json` is updated to include all newly added operational endpoints, specifically:

- config/admin: tariffs, charging windows, station config, users, role updates
- station ops: incidents and charger faults (create/list)
- workflow: driver assign-truck, driver arrive-station, fleet assign-driver, truck availability/location/status
- freight: detail, tracking, accept/pickup/delivery, approve-load, delivery-confirmation
- finance summaries: A2, EEU, stations, fleets
- battery detail/history
- dashboard additions: freight aggregate and A2 live feed
- demo utilities: reset, seed, scenario
