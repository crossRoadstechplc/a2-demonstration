# Financial Simulation and Accounting Logic Documentation

**Date:** 2024  
**Purpose:** Complete documentation of financial simulation, receipt generation, and accounting logic

---

## Overview

The financial simulation ensures that every successful swap transaction produces a complete receipt with all required financial fields. All calculations are deterministic and verified through comprehensive tests.

---

## Receipt Generation

### Required Fields

Every receipt must contain:
1. **swapId** - Link to swap transaction
2. **energyKwh** - Energy delivered (kWh)
3. **energyCharge** - Energy charge (ETB) = `energyKwh * eeuRatePerKwh`
4. **serviceCharge** - Service charge (ETB) = `energyKwh * a2ServiceRatePerKwh`
5. **subtotal** - Subtotal (ETB) = `energyCharge + serviceCharge` (calculated, not stored)
6. **vat** - VAT (ETB) = `subtotal * (vatPercent / 100)`
7. **total** - Total (ETB) = `subtotal + vat`
8. **eeuShare** - EEU share (ETB) = `energyCharge + (vat / 2)`
9. **a2Share** - A2 share (ETB) = `serviceCharge + (vat / 2)`
10. **paymentMethod** - Payment method (random: Telebirr, CBE, M-Pesa, Bank Transfer)
11. **timestamp** - Receipt timestamp

### Calculation Flow

```
1. Get tariff configuration (eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent)
2. Calculate energyCharge = energyKwh * eeuRatePerKwh
3. Calculate serviceCharge = energyKwh * a2ServiceRatePerKwh
4. Calculate subtotal = energyCharge + serviceCharge
5. Calculate vat = subtotal * (vatPercent / 100)
6. Calculate total = subtotal + vat
7. Calculate eeuShare = energyCharge + (vat / 2)
8. Calculate a2Share = serviceCharge + (vat / 2)
9. Verify: total == energyCharge + serviceCharge + vat
10. Verify: total == eeuShare + a2Share
11. Insert receipt into database
```

---

## Energy Calculation

### Standard Trucks

For standard trucks, energy delivered is calculated as:
```
energyDeliveredKwh = (incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100
```

### Refrigerated Trucks

For refrigerated trucks, extra energy is added:
```
baseEnergy = (incomingBattery.capacityKwh * (incomingBattery.soc - arrivalSoc)) / 100
extraEnergy = truck.refrigerationPowerDraw
energyDeliveredKwh = baseEnergy + extraEnergy
```

This extra energy results in higher receipts for refrigerated trucks, as the energy charge and service charge are both calculated from the total `energyDeliveredKwh`.

---

## Tariff Configuration

Default values (configurable via `/config/tariffs`):
- **eeuRatePerKwh**: 10 ETB/kWh
- **a2ServiceRatePerKwh**: 10 ETB/kWh
- **vatPercent**: 15%

These values are stored in `tariff_config` table and can be updated via the config API.

---

## Financial KPIs

### A2 Corridor Revenue
- **Source:** `SUM(total) FROM receipts JOIN swap_transactions WHERE date = today`
- **Calculation:** Sum of all receipt totals for today
- **Endpoint:** `/dashboard/a2` → `corridorRevenue`

### A2 Revenue Share
- **Source:** `SUM(a2Share) FROM receipts WHERE date = today`
- **Calculation:** Sum of all A2 shares for today
- **Endpoint:** `/dashboard/a2` → `a2Share`

### EEU Revenue Share
- **Source:** `SUM(eeuShare) FROM receipts WHERE date = today`
- **Calculation:** Sum of all EEU shares for today
- **Endpoint:** `/dashboard/a2` → `eeuShare`, `/dashboard/eeu` → `eeuRevenueShare`

### VAT Collected
- **Source:** `SUM(vat) FROM receipts WHERE date = today`
- **Calculation:** Sum of all VAT for today
- **Endpoint:** `/dashboard/a2` → `vatCollected`

### Station Revenue Today
- **Source:** `SUM(r.total) FROM receipts r JOIN swap_transactions st WHERE st.stationId = ? AND date = today`
- **Calculation:** Sum of receipt totals for station today
- **Endpoint:** `/dashboard/station/:id` → `revenueTodayEtb`

### Station Revenue This Month
- **Source:** `SUM(r.total) FROM receipts r JOIN swap_transactions st WHERE st.stationId = ? AND month = current month`
- **Calculation:** Sum of receipt totals for station this month
- **Endpoint:** `/dashboard/station/:id` → `revenueThisMonthEtb`

### Fleet Energy Cost
- **Source:** `SUM(r.total) FROM receipts r JOIN swap_transactions st JOIN trucks t WHERE t.fleetId = ? AND date = today`
- **Calculation:** Sum of receipt totals for fleet trucks today (fleet pays full receipt total)
- **Endpoint:** `/dashboard/fleet/:id` → `fleetEnergyCostEtb`

### EEU Electricity Delivered Value
- **Source:** `SUM(energyCharge) FROM receipts WHERE date = today`
- **Calculation:** Sum of energy charges for today
- **Endpoint:** `/billing/summary/eeu` → `totalRevenueEtb` (represents electricity delivered value)

### Average Energy Per Transaction
- **Source:** `SUM(energyKwh) / COUNT(*) FROM receipts WHERE date = today`
- **Calculation:** Average energy per receipt
- **Endpoint:** `/billing/summary/eeu` → `averageEnergyPerTransaction`

---

## Billing Summary Endpoints

### `/billing/summary/a2`

**Access:** ADMIN, A2_OPERATOR  
**Timeframe Support:** daily, monthly, yearly (default: daily)

**Returns:**
- `totalReceipts` - Count of receipts
- `totalEnergyKwh` - Sum of energy delivered
- `totalRevenueEtb` - Sum of receipt totals
- `totalVatEtb` - Sum of VAT
- `totalA2ShareEtb` - Sum of A2 shares
- `totalEeuShareEtb` - Sum of EEU shares
- `averageEnergyPerTransaction` - Average energy per receipt
- `timeframe` - Selected timeframe

### `/billing/summary/eeu`

**Access:** ADMIN, EEU_OPERATOR, A2_OPERATOR  
**Timeframe Support:** daily, monthly, yearly (default: daily)

**Returns:**
- `totalReceipts` - Count of receipts
- `totalEnergyKwh` - Sum of energy delivered
- `totalRevenueEtb` - Sum of energy charges (electricity delivered value)
- `totalVatEtb` - Sum of VAT
- `totalEeuShareEtb` - Sum of EEU shares
- `averageEnergyPerTransaction` - Average energy per receipt
- `timeframe` - Selected timeframe

### `/billing/summary/stations`

**Access:** ADMIN, A2_OPERATOR, STATION_OPERATOR  
**Timeframe Support:** daily, monthly, yearly (default: daily)  
**Visibility:** Station operators see only their own station

**Returns:**
- `revenueByStation[]` - Array of station summaries:
  - `stationId` - Station ID
  - `totalRevenueEtb` - Sum of receipt totals
  - `totalEnergyKwh` - Sum of energy delivered
  - `totalVatEtb` - Sum of VAT
  - `totalA2ShareEtb` - Sum of A2 shares
  - `totalEeuShareEtb` - Sum of EEU shares
  - `totalReceipts` - Count of receipts
  - `averageEnergyPerTransaction` - Average energy per receipt
- `timeframe` - Selected timeframe

### `/billing/summary/fleets`

**Access:** ADMIN, A2_OPERATOR, FLEET_OWNER  
**Timeframe Support:** daily, monthly, yearly (default: daily)  
**Visibility:** Fleet owners see only their own fleet

**Returns:**
- `revenueByFleet[]` - Array of fleet summaries:
  - `fleetId` - Fleet ID
  - `totalRevenueEtb` - Sum of receipt totals
  - `energyCostEtb` - Sum of receipt totals (fleet pays full receipt total)
  - `totalEnergyKwh` - Sum of energy delivered
  - `totalVatEtb` - Sum of VAT
  - `totalA2ShareEtb` - Sum of A2 shares
  - `totalEeuShareEtb` - Sum of EEU shares
  - `totalReceipts` - Count of receipts
  - `averageEnergyPerTransaction` - Average energy per receipt
- `timeframe` - Selected timeframe

---

## Financial Verification Rules

### Rule 1: Total = Energy Charge + Service Charge + VAT
```
total == energyCharge + serviceCharge + vat
```

### Rule 2: Total = EEU Share + A2 Share
```
total == eeuShare + a2Share
```

### Rule 3: EEU Share = Energy Charge + (VAT / 2)
```
eeuShare == energyCharge + (vat / 2)
```

### Rule 4: A2 Share = Service Charge + (VAT / 2)
```
a2Share == serviceCharge + (vat / 2)
```

### Rule 5: VAT = Subtotal * (VAT Percent / 100)
```
vat == (energyCharge + serviceCharge) * (vatPercent / 100)
```

### Rule 6: Subtotal = Energy Charge + Service Charge
```
subtotal == energyCharge + serviceCharge
```

---

## Example Calculations

### Example 1: Standard Truck Swap

**Input:**
- Energy delivered: 294 kWh
- EEU rate: 10 ETB/kWh
- A2 service rate: 10 ETB/kWh
- VAT percent: 15%

**Calculations:**
- Energy charge = 294 * 10 = 2,940 ETB
- Service charge = 294 * 10 = 2,940 ETB
- Subtotal = 2,940 + 2,940 = 5,880 ETB
- VAT = 5,880 * 0.15 = 882 ETB
- Total = 5,880 + 882 = 6,762 ETB
- EEU share = 2,940 + (882 / 2) = 2,940 + 441 = 3,381 ETB
- A2 share = 2,940 + (882 / 2) = 2,940 + 441 = 3,381 ETB
- Verification: 3,381 + 3,381 = 6,762 ✓

### Example 2: Refrigerated Truck Swap

**Input:**
- Base energy: 294 kWh
- Extra energy (refrigeration): 12 kWh
- Total energy delivered: 306 kWh
- EEU rate: 10 ETB/kWh
- A2 service rate: 10 ETB/kWh
- VAT percent: 15%

**Calculations:**
- Energy charge = 306 * 10 = 3,060 ETB
- Service charge = 306 * 10 = 3,060 ETB
- Subtotal = 3,060 + 3,060 = 6,120 ETB
- VAT = 6,120 * 0.15 = 918 ETB
- Total = 6,120 + 918 = 7,038 ETB
- EEU share = 3,060 + (918 / 2) = 3,060 + 459 = 3,519 ETB
- A2 share = 3,060 + (918 / 2) = 3,060 + 459 = 3,519 ETB
- Verification: 3,519 + 3,519 = 7,038 ✓

---

## Reconciliation Rules

### A2 Revenue Reconciliation
```
A2 Dashboard a2Share == SUM(a2Share) FROM receipts WHERE date = today
```

### EEU Revenue Reconciliation
```
EEU Dashboard eeuRevenueShare == SUM(eeuShare) FROM receipts WHERE date = today
```

### Corridor Revenue Reconciliation
```
A2 Dashboard corridorRevenue == SUM(total) FROM receipts JOIN swap_transactions WHERE date = today
```

### Station Revenue Reconciliation
```
Station Dashboard revenueTodayEtb == SUM(total) FROM receipts JOIN swap_transactions WHERE stationId = ? AND date = today
```

### Fleet Energy Cost Reconciliation
```
Fleet Dashboard fleetEnergyCostEtb == SUM(total) FROM receipts JOIN swap_transactions JOIN trucks WHERE fleetId = ? AND date = today
```

---

## Test Coverage

### Accounting Tests (`tests/accounting.test.ts`)

1. **Standard Swap Math** - Verifies receipt calculations for standard trucks
2. **Refrigerated Swap Math** - Verifies receipt calculations for refrigerated trucks with extra energy
3. **VAT Correctness** - Verifies VAT is calculated correctly as percentage of subtotal
4. **Share Split Correctness** - Verifies VAT is split 50/50 between EEU and A2
5. **Station Daily/Monthly Summaries** - Verifies station revenue summaries
6. **Fleet Cost Correctness** - Verifies fleet energy cost calculations
7. **A2 and EEU Totals Reconciliation** - Verifies A2 and EEU totals reconcile against receipts

---

## Implementation Details

### Finance Phase (`src/services/simulation/phases/finance-phase.ts`)

- Finds all swaps without receipts
- Creates receipts for each swap
- Uses tariff configuration from database
- Includes verification checks for calculation correctness
- Generates random payment method

### Receipt Creation

- **Location:** `createReceipt()` function in finance-phase.ts
- **Trigger:** Automatically called for every swap transaction
- **Verification:** Includes runtime checks for calculation correctness
- **Payment Method:** Randomly selected from: Telebirr, CBE, M-Pesa, Bank Transfer

### Billing Summary Endpoints

- All endpoints support timeframe filtering (daily/monthly/yearly)
- All endpoints enforce role-based access control
- All endpoints use scoped queries for visibility
- All endpoints return average energy per transaction

---

## Database Schema

### receipts Table

```sql
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  swapId INTEGER NOT NULL,
  energyKwh REAL NOT NULL,
  energyCharge REAL NOT NULL,
  serviceCharge REAL NOT NULL,
  vat REAL NOT NULL,
  total REAL NOT NULL,
  eeuShare REAL NOT NULL,
  a2Share REAL NOT NULL,
  paymentMethod TEXT NOT NULL DEFAULT 'CBE',
  timestamp TEXT NOT NULL,
  FOREIGN KEY (swapId) REFERENCES swap_transactions(id) ON DELETE CASCADE
);
```

**Note:** `subtotal` is not stored but can be calculated as `energyCharge + serviceCharge`.

---

## End of Documentation

This document provides complete documentation of the financial simulation and accounting logic in the A2 Corridor system.
