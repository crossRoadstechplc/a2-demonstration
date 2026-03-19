# A2 Dashboard Sync Plan

## Overview
Sync the A2 Network Command dashboard with all enhancements made to individual dashboards, ensuring A2 sees the same data and features (except driver dashboard which remains driver-specific).

## Current State Analysis

### A2 Dashboard Currently Shows:
- ✅ Basic KPIs (active trucks, swaps, batteries ready, charging, energy, revenue, shares)
- ✅ Driver/Truck assignments (limited - only plate number and driver name)
- ✅ Station power summary table (basic fields)
- ✅ Live swap activity feed
- ✅ Queue and congestion alerts
- ✅ Operational incidents feed
- ✅ Revenue summary panel
- ✅ A2 live feed panel

### Missing from Individual Dashboards:

#### 1. Station Dashboard Enhancements
- ❌ **Revenue tracking per station**: `revenueTodayEtb`, `revenueThisMonthEtb` (not in station summary table)
- ❌ **Energy charging now**: `energyChargingNowKwh` (not in station summary table)
- ❌ **Charger status**: Real charger counts per station (not in station summary table)
- ❌ **Incoming predictions**: Trucks heading to station with ETA (not shown)
- ⚠️ **Queue size**: Partially shown but needs verification

#### 2. Fleet Dashboard Enhancements
- ❌ **Truck details**: Battery ID, last swap location, truck location (getTruckLocation helper)
- ❌ **Driver details**: Full driver info (name, phone, rating, status, assigned truck)
- ❌ **Driver assignment status**: Attached/pending attachment indicators

#### 3. Driver Dashboard (A2 View - All Drivers)
- ❌ **All drivers list**: Show all drivers with their assigned trucks
- ❌ **Driver details**: Name, phone, rating, status, assigned truck plate
- ❌ **Truck details per driver**: Plate, location, battery ID, last swap location
- ❌ **Driver-truck assignment status**: Visual indicators for attached/pending

#### 4. EEU Dashboard Enhancements
- ⚠️ **Charger counts**: Should be in station summary (verify backend includes this)

## Implementation Plan

### Phase 1: Enhance Station Summary Table
**File**: `Frontend/src/features/a2-dashboard/a2-dashboard.tsx`

1. **Update Station Summary Table Columns**
   - Add "Revenue Today (ETB)" column
   - Add "Revenue This Month (ETB)" column
   - Add "Energy Charging Now (kWh)" column
   - Add "Active Chargers" column (from charger status count)
   - Add "Incoming Trucks" column (count of incoming predictions)

2. **Update Backend Data Fetching**
   - Verify `billingStationsQuery` includes `revenueTodayEtb`, `revenueThisMonthEtb`
   - Verify `billingStationsQuery` includes `energyChargingNowKwh`
   - Verify `billingStationsQuery` includes `chargerStatus` array (count active chargers)
   - Verify `billingStationsQuery` includes `incomingPredictions` array (count incoming trucks)

3. **Update Normalization**
   - Update `normalizeStationPowerSummary` in `normalize.ts` to include new fields
   - Add `revenueTodayEtb`, `revenueThisMonthEtb`, `energyChargingNowKwh`, `activeChargers`, `incomingTrucksCount`

### Phase 2: Enhance Driver/Truck Assignments Panel
**File**: `Frontend/src/features/a2-dashboard/a2-dashboard.tsx`

1. **Expand Driver-Truck Assignments Section**
   - Convert to a detailed table or card grid
   - Show all drivers (not just those with assigned trucks)
   - Include driver details: name, phone, rating, status
   - Include truck details: plate number, location, battery ID, last swap location

2. **Add Helper Functions**
   - Create `getTruckLocation(truck)` helper (similar to fleet dashboard)
   - Create `getLastSwapForTruck(truck, swaps, stations)` helper
   - Add to `normalize.ts` or create utility file

3. **Fetch Additional Data**
   - Ensure `swapsQuery` is fetched (for last swap data)
   - Ensure `stationsQuery` is fetched (for station names in last swap)

4. **Update UI Component**
   - Replace simple list with detailed cards/table
   - Show driver info: name, phone, rating, status badge
   - Show truck info: plate, location, battery ID, last swap
   - Add visual indicators: "Attached", "Pending", "Unassigned"

### Phase 3: Add Driver Details Table
**File**: `Frontend/src/features/a2-dashboard/a2-dashboard.tsx`

1. **Create New Section: "All Drivers & Truck Assignments"**
   - Full table showing all drivers
   - Columns: Driver Name, Phone, Rating, Status, Assigned Truck, Truck Location, Battery ID, Last Swap
   - Filterable/searchable
   - Click to expand details

2. **Data Structure**
   - Use `driversQuery.data` for all drivers
   - Use `trucksQuery.data` to find assigned trucks
   - Use `swapsQuery.data` for last swap info
   - Use `stationsQuery.data` for station names

### Phase 4: Verify Backend Data
**File**: `Backend/src/modules/billing/billing.routes.ts` or `Backend/src/modules/dashboard/dashboard.routes.ts`

1. **Verify Station Summary Endpoint**
   - Check `/billing/summary/stations` includes all new fields
   - If not, add them:
     - `revenueTodayEtb`
     - `revenueThisMonthEtb`
     - `energyChargingNowKwh`
     - `chargerStatus` array (or `activeChargers` count)
     - `incomingPredictions` array (or `incomingTrucksCount`)

2. **Verify Driver Data**
   - Ensure `/drivers` endpoint returns all driver fields
   - Ensure `/trucks` endpoint returns all truck fields including `batteryId`, `locationLat`, `locationLng`

### Phase 5: Update KPI Labels (if needed)
**File**: `Frontend/src/features/a2-dashboard/a2-dashboard.tsx`

1. **Clarify Timeframes**
   - Ensure KPI labels are clear (e.g., "Corridor Energy Today (kWh/day)")
   - Add timeframe indicators where needed

## Files to Modify

### Frontend
1. `Frontend/src/features/a2-dashboard/a2-dashboard.tsx`
   - Update station summary table
   - Enhance driver/truck assignments panel
   - Add new driver details section
   - Add helper functions for truck location and last swap

2. `Frontend/src/features/a2-dashboard/normalize.ts`
   - Update `normalizeStationPowerSummary` to include new fields
   - Add helper functions: `getTruckLocation`, `getLastSwapForTruck`

3. `Frontend/src/features/a2-dashboard/a2-dashboard-skeleton.tsx` (if needed)
   - Update skeleton to match new layout

### Backend (if needed)
1. `Backend/src/modules/billing/billing.routes.ts`
   - Verify/update `/billing/summary/stations` endpoint to include new fields

2. `Backend/src/modules/dashboard/dashboard.routes.ts`
   - Verify station summary data includes all new fields

## Testing Checklist

- [ ] Station summary table shows all new columns
- [ ] Driver/truck assignments panel shows detailed info
- [ ] All drivers are visible (not just assigned)
- [ ] Truck locations are displayed correctly
- [ ] Battery IDs are shown for each truck
- [ ] Last swap locations are shown correctly
- [ ] Driver details (name, phone, rating, status) are displayed
- [ ] Visual indicators for attachment status work correctly
- [ ] Data refreshes correctly with live updates
- [ ] No performance issues with expanded data

## Notes

- Driver dashboard remains driver-specific (no changes needed)
- A2 dashboard should show aggregate/all data
- Ensure data consistency between individual dashboards and A2 dashboard
- Maintain performance with proper memoization and query optimization
