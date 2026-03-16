/**
 * A2 Corridor Simulation Contract Types
 * 
 * This file defines the canonical TypeScript interfaces for all simulation entities
 * and KPI groups. These types serve as the single source of truth for what the
 * simulation must produce and what dashboards can expect.
 * 
 * All simulation implementations must produce data conforming to these interfaces.
 */

// ============================================================================
// Core Entity Interfaces
// ============================================================================

export interface Station {
  id: number;
  name: string;
  location: string;
  locationLat: number;
  locationLng: number;
  status: "ACTIVE" | "INACTIVE";
  capacity: number;
  maxQueueSize: number;
  swapBayCount: number;
}

export interface Truck {
  id: number;
  plateNumber: string;
  fleetId: number;
  truckType: "STANDARD" | "REFRIGERATED";
  batteryId: string | null;
  status: "READY" | "IN_TRANSIT" | "MAINTENANCE" | "IDLE";
  availability: "AVAILABLE" | "ACTIVE" | "IDLE";
  currentSoc: number; // 0-100
  currentStationId: number | null;
  locationLat: number | null;
  locationLng: number | null;
  assignedDriverId: number | null;
  refrigerationPowerDraw: number; // kW, 0 for standard trucks
  temperatureTarget: number | null; // °C, null for standard trucks
  temperatureCurrent: number | null; // °C, null for standard trucks
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  fleetId: number;
  assignedTruckId: number | null;
  status: "AVAILABLE" | "ON_DUTY" | "RESTING" | "ACTIVE";
  overallRating: number; // 0-5
  safetyScore: number; // 0-100
  speedViolations: number;
  harshBrakes: number;
  completedTrips: number;
  tripEfficiency: number; // 0-1
}

export interface Battery {
  id: number;
  capacityKwh: number; // STANDARDIZED: 588 kWh
  soc: number; // 0-100
  status: "READY" | "CHARGING" | "IN_TRUCK" | "MAINTENANCE";
  stationId: number | null;
  truckId: number | null;
  health: number; // 0-100
  cycleCount: number;
  temperature: number; // °C
}

export interface Shipment {
  id: number;
  customerId: number;
  pickupLocation: string;
  pickupLat: number;
  pickupLng: number;
  deliveryLocation: string;
  deliveryLat: number;
  deliveryLng: number;
  cargoDescription: string;
  weight: number; // tonnes
  volume: number; // m³
  pickupWindow: string;
  requiresRefrigeration: number; // 0 or 1
  temperatureTarget: number | null; // °C
  truckId: number | null;
  driverId: number | null;
  status: "REQUESTED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
  approvedLoad: number; // 0 or 1
  assignedAt: string | null; // ISO 8601
  acceptedAt: string | null; // ISO 8601
  pickupConfirmedAt: string | null; // ISO 8601
  deliveryConfirmedAt: string | null; // ISO 8601
}

export interface SwapTransaction {
  id: number;
  truckId: number;
  stationId: number;
  incomingBatteryId: number;
  outgoingBatteryId: number;
  arrivalSoc: number; // 0-100
  energyDeliveredKwh: number;
  timestamp: string; // ISO 8601
}

export interface ChargingSession {
  id: number;
  stationId: number;
  batteryId: number;
  startTime: string; // ISO 8601
  endTime: string | null; // ISO 8601
  startSoc: number; // 0-100
  currentSoc: number; // 0-100
  targetSoc: number; // 0-100, default: 95
  energyAddedKwh: number;
  estimatedCompletion: string | null; // ISO 8601
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

export interface Receipt {
  id: number;
  swapId: number;
  energyKwh: number;
  energyCharge: number; // ETB
  serviceCharge: number; // ETB
  vat: number; // ETB
  total: number; // ETB
  eeuShare: number; // ETB
  a2Share: number; // ETB
  paymentMethod: string;
  timestamp: string; // ISO 8601
}

export interface Incident {
  id: number;
  stationId: number;
  type: "QUEUE_CONGESTION" | "CHARGER_FAULT" | "BATTERY_SHORTAGE" | "POWER_OUTAGE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  status: "OPEN" | "RESOLVED" | "ACKNOWLEDGED";
  reportedAt: string; // ISO 8601
  resolvedAt: string | null; // ISO 8601
}

export interface ChargerFault {
  id: number;
  stationId: number;
  chargerId: string; // e.g., "CHG-01"
  errorCode: string; // e.g., "E114"
  description: string;
  status: "OPEN" | "RESOLVED";
  reportedAt: string; // ISO 8601
  resolvedAt: string | null; // ISO 8601
}

export interface QueueEntry {
  id: number;
  truckId: number;
  stationId: number;
  bookedAt: string; // ISO 8601
  estimatedArrival: string | null; // ISO 8601
  distanceKm: number;
  status: "PENDING" | "ARRIVED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
}

export interface LiveActivityEvent {
  id: number;
  eventType: "SWAP" | "TRUCK_ARRIVAL" | "INCIDENT" | "CHARGING_START" | "CHARGING_COMPLETE" | "SHIPMENT_ASSIGNED" | "SHIPMENT_IN_TRANSIT" | "SHIPMENT_DELIVERED" | "DRIVER_ASSIGNED" | "DRIVER_DETACHED";
  entityType: "TRUCK" | "BATTERY" | "STATION" | "SHIPMENT" | "DRIVER";
  entityId: number;
  message: string;
  timestamp: string; // ISO 8601
  severity: "INFO" | "WARNING" | "ERROR" | null;
}

// ============================================================================
// KPI Group Interfaces
// ============================================================================

export interface A2DashboardKPIs {
  activeTrucks: number;
  swapsToday: number;
  batteriesReady: number;
  chargingActive: number;
  corridorEnergyToday: number; // kWh/day
  corridorRevenue: number; // ETB
  a2Share: number; // ETB
  eeuShare: number; // ETB
  vatCollected: number; // ETB
  stationsOnline: number;
}

export interface FleetDashboardKPIs {
  activeTrucks: number;
  availableTrucks: number;
  activeDrivers: number;
  swapsToday: number;
  fleetEnergyCostEtb: number; // ETB
  completedTrips: number;
  maintenanceAlerts: number;
  refrigeratedTrucksActive: number;
}

export interface StationDashboardKPIs {
  totalBatteries: number;
  readyBatteries: number;
  chargingBatteries: number;
  trucksAtStation: number;
  swapsToday: number;
  energyConsumedToday: number; // kWh
  energyChargingNow: number; // kWh
  revenueTodayEtb: number; // ETB
  revenueThisMonthEtb: number; // ETB
  chargerFaultsOpen: number;
  queueSize: number;
}

export interface DriverDashboardKPIs {
  currentSoc: number; // 0-100
  remainingRange: number; // km
  assignedTruck: string | null; // plate number
  nextDestination: string | null;
  nearestStation: string | null;
  estimatedWait: number; // minutes
}

export interface FreightDashboardKPIs {
  totalShipments: number;
  activeShipments: number;
  deliveredShipments: number;
  estimatedSpendEtb: number; // ETB
  refrigeratedShipments: number;
  pendingDeliveryConfirmations: number;
}

export interface EeuDashboardKPIs {
  totalNetworkLoadKw: number; // kW, live
  totalStationEnergyTodayKwh: number; // kWh/{timeframe}
  electricityDeliveredEtb: number; // ETB/{timeframe}
  eeuRevenueShareEtb: number; // ETB/{timeframe}
  activeChargingSessions: number;
  peakLoadStation: string;
  forecastLoadNext24HoursKw: number; // kW
}

// ============================================================================
// Financial Configuration
// ============================================================================

export interface TariffConfig {
  id: number;
  eeuRatePerKwh: number; // ETB/kWh, default: 10
  a2ServiceRatePerKwh: number; // ETB/kWh, default: 10
  vatPercent: number; // %, default: 15
}

export interface BillingCalculation {
  energyKwh: number;
  energyCharge: number; // ETB = energyKwh * eeuRatePerKwh
  serviceCharge: number; // ETB = energyKwh * a2ServiceRatePerKwh
  subtotal: number; // ETB = energyCharge + serviceCharge
  vat: number; // ETB = subtotal * (vatPercent / 100)
  total: number; // ETB = subtotal + vat
  eeuShare: number; // ETB = energyCharge + (vat / 2)
  a2Share: number; // ETB = serviceCharge + (vat / 2)
}

// ============================================================================
// Simulation State
// ============================================================================

export interface TruckMotionState {
  truckId: number;
  fromStationId: number;
  toStationId: number;
  progress: number; // 0-1
}

export interface SimulationState {
  cycleCount: number;
  lastCycleTimestamp: string; // ISO 8601
  truckMotionStates: Map<number, TruckMotionState>;
  activeChargingSessions: number;
  activeShipments: number;
  totalSwaps: number;
}

// ============================================================================
// Timeframe Types
// ============================================================================

export type Timeframe = "daily" | "monthly" | "yearly";

export interface TimeframeFilter {
  timeframe: Timeframe;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
}

// ============================================================================
// Utility Types
// ============================================================================

export type TruckStatus = Truck["status"];
export type BatteryStatus = Battery["status"];
export type DriverStatus = Driver["status"];
export type ShipmentStatus = Shipment["status"];
export type ChargingSessionStatus = ChargingSession["status"];
export type IncidentSeverity = Incident["severity"];
export type QueueEntryStatus = QueueEntry["status"];
