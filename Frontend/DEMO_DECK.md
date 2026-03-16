# Access Africa A2 · Platform Demo Deck
### Electric Truck Battery-Swap Corridor — Addis Ababa → Djibouti Port

---

## Slide 1 — What is A2?

**Access Africa A2** is a real-time operations platform managing Africa's first heavy-duty electric truck battery-swap corridor, spanning **~900 km** from Addis Ababa to Djibouti Port.

The platform connects every stakeholder in the corridor — operators, station staff, fleet companies, drivers, freight customers, and the national grid utility — through a single, role-authenticated web application.

> *Every metric, every swap, every charge, and every delivery is tracked live.*

---

## Slide 2 — The Corridor

Seven battery-swap stations anchor the corridor:

| Code | Station | Location |
|------|---------|----------|
| STN-001 | Addis Ababa (Main Hub) | Ethiopia |
| STN-002 | Adama | Ethiopia |
| STN-003 | Awash | Ethiopia |
| STN-004 | Mieso | Ethiopia |
| STN-005 | Dire Dawa | Ethiopia |
| STN-006 | Semera / Mille area | Ethiopia |
| STN-007 | Djibouti Port Gateway | Djibouti |

**~2,000 trucks** operate on the corridor. The platform handles battery swaps, charging logistics, freight scheduling, and real-time revenue accounting across all seven stations simultaneously.

---

## Slide 3 — Platform Architecture Overview

The platform is built as a **multi-role SaaS application**:

- **Frontend** — Next.js 14 App Router, React, Tailwind CSS, TanStack Query, Zustand
- **Backend** — Express.js REST API, SQLite (production-ready relational schema)
- **Live Data** — Smart polling every 10–15 seconds + WebSocket support
- **Authentication** — Role-based JWT sessions; every dashboard is scoped to its user's permissions
- **Simulation Engine** — Background simulation runner generates realistic swaps, charges, truck movements, and revenue in real-time for demo purposes

Six distinct roles, six fully-built dashboards:

| Role | Dashboard |
|------|-----------|
| A2 Operator / Admin | Network Command |
| Station Operator | Station Operations |
| Fleet Owner | Fleet Management |
| EEU (Grid Utility) | Grid Control |
| Freight Customer | Freight Portal |
| Driver | Driver App |

---

## Slide 4 — Login & Access

The login page presents a clean split-panel interface:

- **Left panel** — A2 branding and logo
- **Right panel** — Sign-in form with role-specific demo accounts

**Demo Accounts** (one-click to populate):
- `alicea2@example.com` — A2 Operator
- `alicestation@example.com` — Station Operator
- `aliceeeu@example.com` — EEU Grid Controller
- `aliceflight@example.com` — Freight Customer
- `alicefleet@example.com` — Fleet Owner
- `alicedriver@example.com` — Driver

Each user is locked to their own organizational scope — a station operator sees only their station; a fleet owner sees only their fleet. A2 Operators have full cross-entity visibility.

---

## Slide 5 — A2 Network Command Dashboard (1/3) · KPIs

**Audience:** A2 Executives, Operations Managers

**10 Real-time KPIs displayed simultaneously:**

| KPI | What It Measures |
|-----|-----------------|
| Active Trucks | Trucks currently IN_TRANSIT on the corridor |
| Swaps Today | Total battery swap transactions today |
| Batteries Ready | Batteries charged and available for swap now |
| Charging Active | Live charging sessions across all stations |
| Corridor Energy Today (kWh) | Total energy consumed today across the network |
| Corridor Revenue (ETB) | Total gross revenue from all swap transactions |
| A2 Share (ETB) | A2's net revenue after splits |
| EEU Share (ETB) | Ethiopian Electric Utility's revenue share |
| VAT Collected (ETB) | VAT component of all transactions |
| Stations Online | Number of stations currently operational |

All KPIs carry colour-coded **status badges** (success / warning / danger) based on configurable thresholds. Revenue figures are in the **tens of millions of ETB per day** at full corridor load.

---

## Slide 6 — A2 Network Command Dashboard (2/3) · Visualisations

**Live Corridor Map**
- Animated SVG map showing all 7 stations and up to 30 trucks in transit
- Trucks move in real-time along two lanes (eastbound / westbound)
- Hover any station or truck for live stats: batteries ready, charging count, trucks at station, direction, destination
- Expandable to full-screen for presentations

**4 Real-time Charts:**
1. **Station Utilization** — comparative bar chart of power / utilization per station
2. **Battery Inventory** — ready vs. charging vs. in-truck battery split
3. **Charging Activity** — active sessions per station
4. **Truck Movement** — IN_TRANSIT truck distribution across the corridor

**Station Power Summary Table**
- Per-station breakdown: power kWh, revenue ETB, utilization %, batteries ready, charging count, queue depth
- Searchable and filterable

**Driver–Truck Assignment Table**
- Live list of all trucks with assigned drivers

---

## Slide 7 — A2 Network Command Dashboard (3/3) · Tabs

The A2 dashboard has **4 tabs** for deep-dive analysis:

**Overview** — KPIs, map, charts, live event feed, station power table, driver assignments

**Batteries**
- Full battery fleet inventory
- Search by battery ID, filter by status (Ready / Charging / In Truck / Maintenance)
- Table: Battery ID, status, SOC %, health %, cycle count, location (station or truck), temperature, capacity kWh
- Paginated for performance

**Freight**
- All active and historical shipments across the corridor
- Filter by status (Requested / Assigned / In Transit / Delivered / Cancelled)
- Table: shipment ID, pickup/delivery locations, cargo, assigned truck and driver, status
- Paginated

**System Health**
- 8 system-wide health KPIs: stations online/offline, trucks active/idle/maintenance, drivers active/inactive, network utilization
- Alert summary (critical and warning counts)
- Average swap time and charging time metrics

---

## Slide 8 — Station Operations Dashboard (1/2) · KPIs & Visualisations

**Audience:** Station Operators (locked to their own station)

**11 KPIs per station:**

| KPI | Description |
|-----|-------------|
| Total Batteries | All batteries physically at this station |
| Ready Batteries | Charged and swap-ready |
| Charging Batteries | Currently on chargers |
| Trucks at Station | Trucks physically present or approaching (SOC < 35%) |
| Swaps Today | Completed swaps at this station today |
| Energy Consumed Today (kWh) | Total energy drawn today |
| Energy Charging Now (kWh) | Live energy being delivered right now |
| Revenue Today (ETB) | Today's revenue from swaps |
| Revenue This Month (ETB) | Month-to-date revenue |
| Open Charger Faults | Unresolved charger issues |
| Queue Size | Trucks pending swap (present + approaching) |

**Battery Charging Visualization** — visual grid of all batteries at the station, colour-coded by status

**Station Activity Map** — swap floor layout showing which charger bays are active, which batteries are swapping, and ambient temperature

**Swap Payment Notifications** — real-time badge notifications as swap payments land

---

## Slide 9 — Station Operations Dashboard (2/2) · Data Grids

Six paginated data grids giving complete station visibility:

1. **Batteries** — every battery at the station: SOC, health %, cycles, temperature, charger assignment
2. **Charging Sessions** — active and completed sessions: charger ID, energy added, duration, status
3. **Swap Transactions** — today's swaps: truck plate, old battery, new battery, operator, timestamp
4. **Trucks at Station** — all vehicles present: plate, status, SOC %, assigned driver
5. **Incoming Predictions** — next trucks expected: plate, ETA, estimated SOC on arrival
6. **Charger Status Panel** — each charger: ID, status (Active / Ready / Fault), output kW, battery attached
7. **Incidents** — sorted by severity (Critical → High → Medium → Low): description, raised at, resolution status
8. **Charger Faults** — open faults with charger ID, fault type, reported time

**Filters:** battery status (All / Ready / Charging / In Truck / Maintenance), charger status (All / Active / Ready / Fault), station search

**Live polling** every 12 seconds with visual refresh indicator.

---

## Slide 10 — Fleet Management Dashboard (1/2) · KPIs & Map

**Audience:** Fleet Owners (locked to their own fleet)

**8 Fleet KPIs:**

| KPI | Description |
|-----|-------------|
| Active Trucks | Currently IN_TRANSIT |
| Available Trucks | Ready and not assigned to a shipment |
| Active Drivers | Drivers with ACTIVE status |
| Swaps Today | Swaps performed by this fleet's trucks |
| Fleet Energy Cost (ETB) | Total energy cost charged to fleet today |
| Completed Trips | Deliveries completed |
| Maintenance Alerts | Trucks flagged for maintenance |
| Refrigerated Active | Refrigerated trucks currently running |

**Fleet Corridor Activity Map** — the full animated corridor map, filtered to show this fleet's trucks only, with live truck positions

**kWh Today by Truck** — horizontal bar chart showing energy consumption per truck (top consumers ranked), helping fleet managers identify inefficient vehicles

**Export Report** — one-click CSV download of fleet summary + full truck-level detail report

---

## Slide 11 — Fleet Management Dashboard (2/2) · Trucks & Drivers

**Trucks Tab** (paginated, searchable, filterable)

Filter by: truck type (standard / refrigerated), assigned driver (all / unassigned / specific), availability (all / available / in transit / maintenance)

Table columns: plate number, status badge, SOC %, fleet, assigned driver, current location, battery status

- Click any truck → **Detail Drawer** with full truck profile: battery health, cycle count, maintenance flags, swap history
- **Driver Assignment** — select any unassigned driver and assign to a truck inline; recent assignments highlighted with a confirmation animation

**Drivers Tab** (paginated)

Table: driver name, status, assigned truck, fleet, rating, speed violations, harsh brakes — giving fleet managers a behavioural safety view of their workforce

---

## Slide 12 — EEU Grid Control Dashboard (1/2) · KPIs & Grid View

**Audience:** Ethiopian Electric Utility (EEU) — grid operations and revenue management

**7 KPIs with daily / monthly / yearly timeframe toggle:**

| KPI | Description |
|-----|-------------|
| Total Network Load (kW, live) | Combined live kW draw across all stations |
| Station Energy, kWh | Total energy delivered to the corridor |
| Electricity Delivered (ETB) | Revenue from electricity supplied |
| EEU Revenue Share (ETB) | EEU's contracted share of swap fees |
| Active Charging Sessions | How many batteries are charging right now |
| Peak Load Station | Station currently drawing the most power |
| Forecast Load, kW (24h) | Predicted load for the next 24 hours |

**Real-time Network Load Overview**
- The full corridor map embedded in the grid view, showing live truck activity and station status
- **Grid Capacity badge** — colour-coded (green < 65%, amber 65–85%, red > 85% utilization)
- Peak Threshold monitoring status badge

**Electricity Demand by Station** — horizontal utilization bars for each of the 7 stations showing live kW draw and percentage of capacity used

**Charger Power Draw Panel** — per-station count of active chargers at this moment

---

## Slide 13 — EEU Grid Control Dashboard (2/2) · Analytics & Finance

**Grid Capacity Utilization Chart** — single bar showing current % of grid capacity consumed by the corridor; colour shifts to warning/danger as threshold is approached

**24-hour Load Forecast Chart** — hourly bar chart projecting kW load for each hour of the next 24 hours, enabling EEU to pre-position capacity

**Station-level Power Table**
Full cross-station table: station name, live load (kW), energy (kWh/day, month, or year), active chargers count, utilization % badge

**Power Interruptions / Notices Panel**
Live alerts from EEU backend: tariff updates, grid notices, load-shedding warnings — severity badged (info / warning / danger)

**EEU Finance Summary Panel**
- Total Energy Delivered (kWh)
- EEU Revenue Share (ETB)
- VAT Share (ETB)
- Total Transactions
- Average Energy per Transaction (kWh)
- Current Tariff Rate (ETB / kWh)

**EEU Payment Notifications** — real-time pop-up feed of swap payments, showing EEU's earned share per transaction as it happens

---

## Slide 14 — Freight Customer Portal (1/2) · KPIs & Booking

**Audience:** Freight companies using A2 electric trucks for cargo logistics

**6 KPIs (daily / monthly / yearly timeframe):**

| KPI | Description |
|-----|-------------|
| Total Shipments | All shipments in selected period |
| Active Shipments | Currently in transit |
| Delivered Shipments | Successfully completed |
| Estimated Spend (ETB) | Projected total freight cost |
| Refrigerated Shipments | Cold-chain shipments |
| Pending Delivery Confirmations | Delivered but awaiting customer sign-off |

**New Freight Booking Form**
- Pickup station (dropdown of all 7 corridor stations)
- Delivery station
- Cargo description
- Weight (tonnes) and Volume (m³)
- Pickup time window
- Refrigeration required toggle + temperature target (°C)
- **Live price estimator** — calculates estimated ETB cost as form values change (based on weight, volume, and refrigeration premium)
- Form validation with inline field-level error messages

---

## Slide 15 — Freight Customer Portal (2/2) · Tracking & Shipments

**Active Shipment Detail Panel**
- Selected shipment summary: pickup → delivery, cargo description, weight, volume
- Assigned truck plate number and assigned driver name
- Status badge (Requested / Assigned / In Transit / Delivered / Cancelled)

**Shipment Tracking Timeline**
- Chronological event list: booking confirmed, truck assigned, pickup confirmed, in transit, delivered
- Each event timestamped; unconfirmed future events shown as pending steps

**Available Trucks Panel**
- Trucks that are ready and closest to the selected pickup station
- Per truck: plate, type (standard / refrigerated), distance to pickup (km), estimated arrival time

**Shipments Table**
- All shipments for this customer: ID, pickup, delivery, cargo, assigned truck, assigned driver, status badge, timestamps (assigned, pickup confirmed, delivery confirmed)

**Confirm Delivery Modal** — freight customers can confirm receipt of goods directly from the dashboard, closing the transaction loop

---

## Slide 16 — Driver App Dashboard (1/2) · Status & Navigation

**Audience:** Individual truck drivers (each driver sees only their own data)

**Driver Status Panel**
- Current assigned truck plate and battery status
- **State of Charge (SOC %)** prominently displayed with estimated remaining range in km (calculated as SOC × 3.2 km/%)
- Truck telemetry warnings: speed violations count, harsh braking events
- Driver rating and compliance indicators

**Truck Attach / Detach**
- Drivers can self-assign to a truck by entering the truck's plate/code
- Or detach from their current truck
- Instant backend update with notification confirmation

**Nearest Swap Stations Panel**
Four nearest stations ranked by distance, each showing:
- Station name
- Ready batteries available for swap
- Current queue depth
- Distance (km)
- ETA in minutes

This enables drivers to make smart routing decisions to minimise downtime.

**Live Corridor Map** — the full animated corridor map, showing the driver's current position context and all 7 swap stations with live battery availability

---

## Slide 17 — Driver App Dashboard (2/2) · Shipments & Payments

**Active Shipment Panel**
- Current assigned shipment: pickup location, delivery location, next destination
- ETA to delivery (calculated from pickup confirmation time)
- Status tracking with live status badge

**Swap Payment History — Pending**
- List of unpaid battery-swap receipts linked to this driver's truck
- Each receipt: swap ID, station, ETB amount, timestamp
- **Pay Now** button — opens inline payment modal showing receipt breakdown (energy kWh, rate, A2 share, EEU share, VAT) and confirms payment

**Swap Payment History — Paid**
- Completed payment history with receipt detail access
- Click any paid entry → **Receipt Detail Drawer** showing full itemised breakdown:
  - Energy (kWh)
  - Rate (ETB/kWh)
  - Gross amount
  - A2 share
  - EEU share
  - VAT
  - Payment timestamp

**Activity Log** — last 8 recent driver activities (swaps, assignments, shipment events)

---

## Slide 18 — Cross-Platform Features

Features built consistently across all dashboards:

**Live Refresh System**
- Smart polling with configurable intervals (10–15 seconds depending on dashboard criticality)
- WebSocket support for instant push updates on A2 and EEU dashboards
- Visual live refresh indicator showing last sync time and active status
- Manual refresh button on all dashboards

**Notification System**
- Toast notifications for all async actions (success / error / info)
- Dismissible individually or all at once ("Dismiss All")
- Stacked notification panel with item count

**Role-Based Access Control**
- JWT authentication; all API endpoints enforce role permissions server-side
- Station Operators: locked to their assigned station (dropdown disabled)
- Fleet Owners: locked to their fleet (dropdown disabled)
- Drivers: locked to their driver profile
- Freight Customers: locked to their customer account
- A2 Operators / Admins: full cross-entity access

**Pagination** — all data grids paginated for performance; page size, current page, and total count always shown

**Light / Dark Mode** — toggle in topbar (sun / moon icon); defaults to light mode

---

## Slide 19 — Data Model & Revenue Flow

**Revenue Flow (per battery swap):**

```
Truck arrives at station
        ↓
Battery swap completed
        ↓
Receipt generated
   └─ Gross amount (energy kWh × tariff rate)
        ↓
Split applied
   ├─ A2 Share  (~52% of gross)
   ├─ EEU Share (~35% of gross)
   └─ VAT       (~15% of gross)
        ↓
All three parties see their share in real-time
```

**Key Entities:**
- **Stations** (7) — physical swap locations with batteries, chargers, and swap bays
- **Batteries** — tracked individually: SOC, health, temperature, cycle count, location (station / truck / unknown)
- **Trucks** — tracked individually: status, SOC, assigned driver, fleet, current station, location coordinates
- **Drivers** — linked to fleets; real-time rating, safety telemetry
- **Fleets** — groups of trucks and drivers owned by a fleet company
- **Shipments** — freight requests from customers, assigned to trucks and drivers
- **Swap Transactions** — every swap event, linked to truck, station, battery, and driver
- **Charging Sessions** — every charge event, linked to battery and station charger
- **Receipts** — financial records per swap: gross, A2 share, EEU share, VAT, payment status

---

## Slide 20 — Summary & Key Demo Talking Points

**The A2 platform demonstrates end-to-end digital infrastructure for Africa's electric freight revolution.**

### What to highlight in the demo:

1. **Scale** — 2,000 trucks, 7 stations, real-time data across a 900 km corridor
2. **Multi-stakeholder** — six distinct roles, each with a purpose-built, fully functional dashboard
3. **Revenue transparency** — every swap generates a live, auditable receipt split between A2, EEU, and VAT. Revenue in the tens of millions ETB/day at scale
4. **Operational intelligence** — battery SOC-based queue prediction, charger fault tracking, driver safety telemetry, load forecasting
5. **Grid integration** — EEU has a dedicated dashboard showing live kW demand, 24h forecasts, and revenue share — a first for an African utility in this context
6. **Freight logistics** — end-to-end freight booking, truck assignment, live tracking, and delivery confirmation in one portal
7. **Driver empowerment** — drivers can find the nearest battery station, pay for swaps, and manage their own profile in real-time
8. **Production-ready architecture** — JWT auth, role scoping, live sync, pagination, error handling, light/dark mode, mobile-responsive

> *This is not a mockup. Every dashboard reads from a live backend, every number is computed from real simulation data, and every action triggers real database writes.*

---

*Prepared for Access Africa A2 · March 2026*
