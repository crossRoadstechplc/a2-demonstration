# Why Simulation Fixes Weren't Showing — and How to Fix It

## Root Cause

**The bootstrap phase only runs when the battery count is 0.**

In `Backend/src/services/simulation/phases/bootstrap-phase.ts`:

```typescript
async function ensureSimulationBatteries(stationIds: number[]): Promise<void> {
  const batteryCount = await getQuery<{ count: number }>("SELECT COUNT(*) as count FROM batteries;");
  if ((batteryCount?.count ?? 0) > 0) {
    return;  // ← Skips entirely if any batteries exist!
  }
  // ... creates 2500-3000 batteries, READY distribution, etc.
}
```

If the database already has batteries (from a previous run, a demo scenario like "Morning Operations", or any other source), the bootstrap **skips** and your fixes never run.

## What Was Happening

1. You applied fixes to `bootstrap-phase.ts` (READY batteries, 2500–3000 total, revenue scaling).
2. The database still had old data (e.g. 10 batteries per station from a demo scenario).
3. On each simulation cycle, bootstrap saw `batteryCount > 0` and returned immediately.
4. The dashboard kept showing the old values.

## The Fix

A new **Reset Simulation Data** flow clears simulation data and forces bootstrap to run:

1. **Backend**: `POST /simulation/reset` (Admin/A2_OPERATOR only)
   - Deletes batteries, swap_transactions, receipts, charging_sessions, etc.
   - Clears truck battery references
   - Runs one simulation cycle immediately so bootstrap creates fresh data

2. **Frontend**: "Reset Simulation Data" button in Demo Controls
   - Calls the reset endpoint
   - Invalidates dashboard queries so new data appears right away

## How to Use

1. Open **Demo Controls** (top right when logged in as Admin or A2 Operator).
2. Click **"Reset Simulation Data"**.
3. Confirm the action.
4. The dashboard should refresh with:
   - READY batteries > 0
   - Total batteries ~2500–3000
   - Higher revenue from 800–1000 historical swaps

## Alternative: Full Reset

If you prefer a full reset:

1. **Reset Demo** — wipes everything.
2. **Seed Demo Data** — recreates stations, trucks, drivers (no batteries).
3. **Start All** — simulation runs bootstrap and creates batteries.

## Order of Operations

- **Correct**: Seed → Start simulation (bootstrap runs with 0 batteries).
- **Incorrect**: Seed → Activate scenario (e.g. Morning Operations) → Start simulation.  
  Scenarios create batteries via `ensureDemoBatteries`, so bootstrap sees `count > 0` and skips.

Use **Reset Simulation Data** whenever you want to re-run bootstrap without a full seed.
