# Simulation Contract Summary

**Quick Reference Guide**

This document provides a quick overview of the A2 Corridor simulation contract. For detailed specifications, see:
- `SIMULATION_CONTRACT.md` - Full contract specification
- `src/types/simulation-contract.ts` - TypeScript interfaces
- `KPI_MAPPING_TABLE.md` - KPI calculation mappings

---

## Core Principles

1. **Single Source of Truth:** All dashboards derive from the same database state
2. **No Fake Data:** All KPIs calculated from actual records
3. **Deterministic:** Same input state always produces same output
4. **Synchronized:** All dashboards see consistent data within one refresh cycle

---

## Entity Checklist

Every simulation cycle must update:

- ✅ **Stations** - Static (coordinates don't change)
- ✅ **Trucks** - Location, SOC, status, battery assignment
- ✅ **Drivers** - Assignment, status, telemetry, performance
- ✅ **Batteries** - SOC, status, location, health, cycles
- ✅ **Shipments** - Status transitions, assignments
- ✅ **Swaps** - Transaction creation, battery assignments
- ✅ **Charging Sessions** - SOC progression, energy tracking
- ✅ **Receipts** - Created for every swap
- ⚠️ **Incidents** - Created when conditions met
- ⚠️ **Charger Faults** - Created with 1-2% chance per charger
- ❌ **Queue Entries** - **MISSING** - Simulation doesn't populate `swap_queue`
- ❌ **Live Activity Events** - **MISSING** - No event generation system

---

## Critical Rules

### Battery Capacity
- **STANDARD:** All batteries = **588 kWh** (no exceptions)

### Financial Calculations
- Receipt created for **every** swap
- A2 share = `serviceCharge + (vat / 2)`
- EEU share = `energyCharge + (vat / 2)`
- All amounts rounded to 2 decimal places

### Truck Movement
- Location updated **every cycle** during transit
- SOC drains: `3% + (refrigerationPowerDraw * 0.25%)` per cycle
- Only moves if driver assigned

### Charging
- Only during charging window (default: 20:00-06:00)
- SOC increases by 10% per cycle
- Completes at 95% SOC

### Shipments
- **Immediate assignment** required (or reject)
- 5-12 active shipments maintained
- 2-3 delivered per cycle

---

## Dashboard Data Requirements

### A2 HQ
- **Scope:** Full system access
- **KPIs:** 10 KPIs (all from aggregates)
- **Missing:** Live feed events, performance metrics

### Fleet
- **Scope:** Own fleet only (`fleetId = organizationId`)
- **KPIs:** 8 KPIs (fleet-scoped aggregates)
- **Missing:** Energy cost timeframe filtering

### Station
- **Scope:** Own station only (`stationId = organizationId`)
- **KPIs:** 11 KPIs (station-scoped aggregates)
- **Missing:** Queue population, charger fault generation

### Driver
- **Scope:** Own profile only (`driverId = organizationId`)
- **KPIs:** 6 KPIs (driver-scoped data)
- **Missing:** Real queue data (uses simulated)

### Freight
- **Scope:** Own shipments only (`customerId = organizationId`)
- **KPIs:** 6 KPIs (customer-scoped aggregates)
- **Status:** ✅ Complete

### EEU
- **Scope:** Network-wide energy data
- **KPIs:** 7 KPIs (energy aggregates)
- **Missing:** 24h forecast calculation

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Core Entities | ✅ 85% | Most entities working |
| Financial Tracking | ✅ 90% | Receipts working, needs timeframe filtering |
| Queue Management | ❌ 30% | Table exists, logic missing |
| Charger Operations | ⚠️ 70% | Status works, faults missing |
| Shipment Progression | ✅ 80% | Basic flow works, refinements needed |
| Driver Management | ⚠️ 75% | Assignments work, ratings missing |
| Live Events | ❌ 0% | No event generation |

---

## Next Steps

1. **Implement queue management** (Critical)
2. **Add charger fault simulation** (Critical)
3. **Generate live activity events** (Critical)
4. **Add timeframe filtering** to all financial KPIs (Important)
5. **Update driver ratings** based on performance (Important)

---

## Contract Files

- `SIMULATION_CONTRACT.md` - Full specification (800+ lines)
- `src/types/simulation-contract.ts` - TypeScript interfaces
- `KPI_MAPPING_TABLE.md` - KPI calculation mappings
- `SIMULATION_CONTRACT_SUMMARY.md` - This file

---

**Last Updated:** 2024  
**Version:** 1.0
