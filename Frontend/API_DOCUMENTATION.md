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

- `batteriesAtStation`
- `activeChargingSessions`
- `swapsToday`
- `energyToday`

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

- runs every 30 seconds
- moves trucks between stations
- reduces battery SOC
- triggers swaps when SOC < 20%
- creates/advances overnight charging sessions

### POST `/simulation/stop`
Stops the background simulation loop.

---

## Postman Collection

Use `A2_Corridor_Backend.postman_collection.json` at backend root.

- Set `baseUrl` to your running API URL
- Run `Auth > Register` or `Auth > Login` first to populate `authToken`
