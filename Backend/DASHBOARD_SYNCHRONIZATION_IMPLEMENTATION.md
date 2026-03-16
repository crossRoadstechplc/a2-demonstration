# Dashboard Synchronization and Visibility Implementation

**Date:** 2024  
**Purpose:** Implementation of strict dashboard synchronization and visibility-safe aggregation across all 6 dashboards

---

## Overview

This implementation ensures that:
1. All dashboard aggregates come from the same underlying simulation records
2. No duplicate counters that can drift
3. All revenue, energy, swaps, and shipment counts reconcile across dashboards
4. Strict role-based visibility rules are enforced

---

## Architecture

### Scoped Query Service (`src/services/scoped-queries.ts`)

A centralized service that provides visibility-safe query helpers for each dashboard type:

- **`scopedQueries.a2`** - Full system access queries (ADMIN, A2_OPERATOR)
- **`scopedQueries.fleet`** - Fleet-scoped queries (fleetId = organizationId)
- **`scopedQueries.station`** - Station-scoped queries (stationId = organizationId)
- **`scopedQueries.driver`** - Driver-scoped queries (driverId = organizationId)
- **`scopedQueries.freight`** - Customer-scoped queries (customerId = organizationId)
- **`scopedQueries.eeu`** - Energy-only queries (no operational data)

### Scoped Entity Queries (`scopedEntities`)

Visibility-safe entity list queries that enforce role-based access:
- `getTrucks(req)` - Returns trucks based on role
- `getDrivers(req)` - Returns drivers based on role
- `getBatteries(req)` - Returns batteries based on role
- `getShipments(req)` - Returns shipments based on role
- `getSwaps(req)` - Returns swaps based on role
- `getStations(req)` - All roles can see stations (for context)

---

## Visibility Rules Implementation

### A2 HQ Dashboard
- **Access:** `ADMIN`, `A2_OPERATOR`
- **Visibility:** Full system access
- **Enforcement:** `requireAnyRole(["ADMIN", "A2_OPERATOR"])`

### Fleet Dashboard
- **Access:** `FLEET_OWNER`, `ADMIN`, `A2_OPERATOR`
- **Visibility:** 
  - Own fleet's trucks, drivers, shipments, swaps, billing
  - All stations (for context)
  - All batteries (for lookup only)
- **Enforcement:** 
  - `requireAnyRole(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"])`
  - Checks `organizationId === fleetId` for FLEET_OWNER

### Station Dashboard
- **Access:** `STATION_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Visibility:**
  - Own station's batteries, swaps, charging, incidents, charger faults, revenue, energy
  - All stations/trucks (for context only)
- **Enforcement:**
  - `requireAnyRole(["STATION_OPERATOR", "ADMIN", "A2_OPERATOR"])`
  - Checks `organizationId === stationId` for STATION_OPERATOR

### Driver Dashboard
- **Access:** `DRIVER`, `ADMIN`, `A2_OPERATOR`
- **Visibility:**
  - Own profile, assigned truck, own shipments, own swaps
  - All stations (for navigation)
  - All trucks/batteries (for map visualization only)
- **Enforcement:**
  - `requireAnyRole(["DRIVER", "ADMIN", "A2_OPERATOR"])`
  - Checks `organizationId === driverId` for DRIVER

### Freight Dashboard
- **Access:** `FREIGHT_CUSTOMER`, `ADMIN`, `A2_OPERATOR`
- **Visibility:**
  - Own shipments only
  - All stations (for booking)
  - Available trucks (for booking context)
  - Assigned driver (for own shipments only)
- **Enforcement:**
  - `requireAnyRole(["FREIGHT_CUSTOMER", "ADMIN", "A2_OPERATOR"])`
  - Checks `organizationId === customerId` for FREIGHT_CUSTOMER

### EEU Dashboard
- **Access:** `EEU_OPERATOR`, `ADMIN`, `A2_OPERATOR`
- **Visibility:**
  - All energy data
  - All stations (for energy view)
  - Trucks and batteries (for map visualization only)
  - No driver details
  - No customer shipment visibility
  - No full A2 commercial data
- **Enforcement:**
  - `requireAnyRole(["EEU_OPERATOR", "ADMIN", "A2_OPERATOR"])`
  - Uses energy-only scoped queries

---

## Synchronization Guarantees

### Single Source of Truth

All KPIs are derived from the same underlying database tables:

- **Revenue:** All dashboards query `receipts` table
- **Energy:** All dashboards query `swap_transactions` and `charging_sessions` tables
- **Swaps:** All dashboards query `swap_transactions` table
- **Trucks:** All dashboards query `trucks` table
- **Charging:** All dashboards query `charging_sessions` table
- **Shipments:** All dashboards query `shipments` table

### Reconciliation Rules

1. **A2 Revenue = Sum of Receipts A2 Share**
   - A2 dashboard: `SUM(a2Share) FROM receipts WHERE date = today`
   - Verified in reconciliation tests

2. **EEU Revenue = Sum of Receipts EEU Share**
   - EEU dashboard: `SUM(eeuShare) FROM receipts WHERE date = today`
   - Verified in reconciliation tests

3. **Corridor Revenue = Sum of Receipt Totals**
   - A2 dashboard: `SUM(total) FROM receipts JOIN swap_transactions WHERE date = today`
   - Verified in reconciliation tests

4. **Station Energy = Sum of Charging Sessions**
   - Station dashboard: `SUM(energyAddedKwh) FROM charging_sessions WHERE stationId = ? AND status = 'ACTIVE'`
   - Verified in reconciliation tests

5. **Swaps Today = Count of Swap Transactions**
   - All dashboards: `COUNT(*) FROM swap_transactions WHERE date = today`
   - Verified in reconciliation tests

6. **Fleet Energy Cost = Sum of Receipts for Fleet Trucks**
   - Fleet dashboard: `SUM(total) FROM receipts JOIN swap_transactions JOIN trucks WHERE fleetId = ?`
   - Verified in reconciliation tests

---

## Implementation Details

### Dashboard Endpoint Updates

All dashboard endpoints now:
1. Use `requireAuth` middleware
2. Use `requireAnyRole` middleware for role checking
3. Enforce visibility rules before querying
4. Use scoped queries from `scopedQueries` service
5. Return 403 Forbidden if visibility rules are violated

### Example: Fleet Dashboard Endpoint

```typescript
dashboardRouter.get(
  "/dashboard/fleet/:id",
  requireAuth,
  requireAnyRole(["FLEET_OWNER", "ADMIN", "A2_OPERATOR"]),
  async (req, res, next) => {
    // Enforce visibility
    const userOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
    if (req.user?.role === "FLEET_OWNER" && userOrgId !== fleetId) {
      res.status(403).json({ error: "Forbidden: Cannot access other fleet's data" });
      return;
    }

    // Use scoped queries
    const activeTrucks = await scopedQueries.fleet.countActiveTrucks(req);
    const swapsToday = await scopedQueries.fleet.countSwapsToday(req);
    // ... etc
  }
);
```

---

## Test Coverage

### Visibility Tests (`tests/dashboard-visibility.test.ts`)

Tests that verify:
- ✅ Fleet owner cannot see another fleet's data
- ✅ Station operator cannot see another station's data
- ✅ Driver cannot see another driver's profile
- ✅ Freight customer cannot see another customer's shipments
- ✅ EEU operator cannot access A2 dashboard
- ✅ Only admin and A2 operator can access A2 dashboard

### Reconciliation Tests (`tests/dashboard-reconciliation.test.ts`)

Tests that verify:
- ✅ A2 revenue equals sum of receipts A2 share
- ✅ EEU revenue equals sum of receipts EEU share
- ✅ Corridor revenue equals sum of receipt totals
- ✅ Station energy summaries match charging sessions
- ✅ Swaps today match actual swap records
- ✅ Fleet energy cost matches receipts for fleet trucks

---

## Data Flow

### Query Flow

1. **Request arrives** → `requireAuth` middleware validates token
2. **Role check** → `requireAnyRole` middleware validates role
3. **Visibility check** → Endpoint checks `organizationId` match
4. **Scoped query** → Uses `scopedQueries` service with request context
5. **Response** → Returns scoped data only

### Example: Fleet Dashboard Query Flow

```
Request: GET /dashboard/fleet/1
  ↓
requireAuth: Validates token, sets req.user
  ↓
requireAnyRole: Validates role is FLEET_OWNER, ADMIN, or A2_OPERATOR
  ↓
Visibility Check: If FLEET_OWNER, verify organizationId === 1
  ↓
Scoped Query: scopedQueries.fleet.countActiveTrucks(req)
  → SQL: SELECT COUNT(*) FROM trucks WHERE fleetId = ? AND status IN ('READY', 'IN_TRANSIT')
  → Uses req.user.organizationId as parameter
  ↓
Response: Returns scoped data
```

---

## Benefits

1. **Data Integrity:** All dashboards use the same underlying data
2. **Security:** Strict role-based access control
3. **Consistency:** No duplicate counters that can drift
4. **Maintainability:** Centralized query logic in scoped-queries service
5. **Testability:** Comprehensive test coverage for visibility and reconciliation
6. **Scalability:** Easy to add new dashboards or roles

---

## Future Enhancements

1. **Caching:** Add caching layer for expensive aggregations
2. **WebSocket:** Real-time push updates for dashboard synchronization
3. **Audit Logging:** Log all dashboard access for security auditing
4. **Rate Limiting:** Add rate limiting to prevent abuse
5. **Query Optimization:** Add database indexes for frequently queried fields

---

## End of Documentation

This implementation ensures strict dashboard synchronization and visibility-safe aggregation across all 6 dashboards in the A2 Corridor system.
