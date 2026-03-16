import type { A2DashboardSummary } from "@/types/dashboard";
import type { LiveFeedEventGroup } from "@/types/live-feed";
import type { Battery } from "@/types/battery";
import type { Truck } from "@/types/truck";
import type { Station } from "@/types/station";
import type { Shipment } from "@/types/shipment";
import type { Driver } from "@/types/driver";
import type { SwapTransaction } from "@/types/swap";

export interface StationPowerSummary {
  stationName: string;
  powerKwh: number;
  revenueEtb: number;
  utilizationPct: number;
  batteriesReady: number;
  chargingCount: number;
  queueCount: number;
}

export interface OperationEvent {
  id: string;
  title: string;
  detail: string;
  severity: "success" | "warning" | "danger" | "info" | "neutral";
  timestamp: string;
}

export interface A2Kpis {
  activeTrucks: number;
  swapsToday: number;
  batteriesReady: number;
  chargingSessionsActive: number;
  corridorEnergyToday: number;
  corridorRevenueEtb: number;
  a2ShareEtb: number;
  eeuShareEtb: number;
  vatCollectedEtb: number;
  stationsOnline: number;
}

function readNumber(input: unknown, keys: string[]): number {
  if (!input || typeof input !== "object") {
    return 0;
  }

  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function readString(input: unknown, keys: string[], fallback = "Unknown"): string {
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeKpis(
  a2Summary: A2DashboardSummary | undefined,
  liveFeed: LiveFeedEventGroup | undefined,
  billingSummaryA2: unknown
): A2Kpis {
  // Use live-feed counts as a fallback if the backend value is 0
  const chargingStarts = asArray(liveFeed?.chargingStarts).length;
  const chargingCompletions = asArray(liveFeed?.chargingCompletions).length;
  const chargingFromFeed = Math.max(0, chargingStarts - chargingCompletions);

  return {
    activeTrucks: a2Summary?.activeTrucks ?? 0,
    swapsToday: a2Summary?.swapsToday ?? 0,
    batteriesReady: a2Summary?.batteriesReady ?? 0,
    chargingSessionsActive: a2Summary?.chargingActive ?? chargingFromFeed,
    corridorEnergyToday: a2Summary?.corridorEnergyToday ?? 0,
    corridorRevenueEtb:
      a2Summary?.corridorRevenue ??
      readNumber(billingSummaryA2, ["totalRevenue", "totalRevenueEtb", "grossRevenueEtb"]),
    a2ShareEtb:
      a2Summary?.a2Share ??
      readNumber(billingSummaryA2, ["a2Share", "a2ShareEtb", "totalA2ShareEtb"]),
    eeuShareEtb:
      a2Summary?.eeuShare ??
      readNumber(billingSummaryA2, ["eeuShare", "eeuShareEtb", "totalEeuShareEtb"]),
    vatCollectedEtb:
      a2Summary?.vatCollected ??
      readNumber(billingSummaryA2, ["vatCollected", "vatCollectedEtb", "totalVatEtb"]),
    stationsOnline: a2Summary?.stationsOnline ?? 0,
  };
}

export function normalizeStationPowerSummary(payload: unknown): StationPowerSummary[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  const rows = asArray(root.stations ?? root.stationSummaries ?? root.revenueByStation ?? payload);

  return rows.map((row, index) => ({
    stationName: readString(row, ["stationName", "name"], `Station ${index + 1}`),
    powerKwh: readNumber(row, [
      "powerConsumptionKwh",
      "energyKwh",
      "energyConsumedKwh",
      "totalEnergyKwh",
    ]),
    revenueEtb: readNumber(row, ["revenueEtb", "totalRevenueEtb", "totalRevenue"]),
    utilizationPct: readNumber(row, ["utilizationPct", "utilization", "loadPct"]),
    batteriesReady: readNumber(row, ["batteriesReady", "readyBatteries"]),
    chargingCount: readNumber(row, ["chargingCount", "chargingSessions"]),
    queueCount: readNumber(row, ["queueCount", "queueSize"]),
  }));
}

function mapEvents(items: unknown[], label: string, severity: OperationEvent["severity"]) {
  return items.map((item, index) => ({
    id: `${label}-${index}`,
    title: readString(item, ["eventType", "type", "status"], label),
    detail: readString(item, ["message", "note", "stationName"], "Live operation update"),
    timestamp: readString(item, ["timestamp", "reportedAt", "createdAt"], "now"),
    severity,
  }));
}

export function normalizeLiveEvents(feed: LiveFeedEventGroup | undefined): {
  swapEvents: OperationEvent[];
  incidents: OperationEvent[];
  a2LiveFeed: OperationEvent[];
} {
  const swaps = mapEvents(asArray(feed?.swaps), "Swap", "info");
  const incidents = [
    ...mapEvents(asArray(feed?.incidents), "Incident", "danger"),
    ...mapEvents(asArray(feed?.chargerFaults), "Charger Fault", "warning"),
    ...mapEvents(asArray(feed?.truckArrivals), "Truck Arrival", "neutral"),
  ];

  const a2LiveFeed = [
    ...swaps,
    ...mapEvents(asArray(feed?.chargingStarts), "Charging Start", "success"),
    ...mapEvents(asArray(feed?.chargingCompletions), "Charging Complete", "success"),
    ...incidents,
    ...mapEvents(asArray(feed?.freightAssignments), "Freight", "info"),
  ].slice(0, 12);

  return {
    swapEvents: swaps.slice(0, 8),
    incidents: incidents.slice(0, 8),
    a2LiveFeed,
  };
}

export interface BatteryRow {
  id: number;
  status: string;
  soc: number;
  health: number;
  cycleCount: number;
  locationType: "Station" | "Truck" | "Unknown";
  locationName: string;
  temperature: number;
  capacityKwh: number;
}

export function getBatteryLocation(
  battery: Battery,
  trucks: Truck[],
  stations: Station[]
): { type: "Station" | "Truck" | "Unknown"; name: string } {
  if (battery.truckId) {
    const truck = trucks.find((t) => t.id === battery.truckId);
    return { type: "Truck", name: truck?.plateNumber ?? `Truck #${battery.truckId}` };
  }
  if (battery.stationId) {
    const station = stations.find((s) => s.id === battery.stationId);
    return { type: "Station", name: station?.name ?? `Station #${battery.stationId}` };
  }
  return { type: "Unknown", name: "Unknown" };
}

export function normalizeBatteryRows(
  batteries: Battery[],
  trucks: Truck[],
  stations: Station[]
): BatteryRow[] {
  return batteries.map((battery) => {
    const location = getBatteryLocation(battery, trucks, stations);
    return {
      id: battery.id,
      status: battery.status,
      soc: battery.soc,
      health: battery.health,
      cycleCount: battery.cycleCount,
      locationType: location.type,
      locationName: location.name,
      temperature: battery.temperature,
      capacityKwh: battery.capacityKwh,
    };
  });
}

export interface FreightRow {
  id: number;
  customerId: number | null;
  pickupLocation: string;
  deliveryLocation: string;
  cargoDescription: string;
  weight: number;
  volume: number;
  status: string;
  assignedTruck: string;
  assignedDriver: string;
  pickupWindow: string;
  requiresRefrigeration: boolean;
  assignedAt: string | null;
  pickupConfirmedAt: string | null;
  deliveryConfirmedAt: string | null;
}

export function normalizeFreightRows(
  shipments: Shipment[],
  trucks: Truck[],
  drivers: Driver[]
): FreightRow[] {
  const truckById = new Map(trucks.map((t) => [t.id, t]));
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  return shipments.map((shipment) => {
    const truck = shipment.truckId ? truckById.get(shipment.truckId) : null;
    const driver = shipment.driverId ? driverById.get(shipment.driverId) : null;

    return {
      id: shipment.id,
      customerId: shipment.customerId,
      pickupLocation: shipment.pickupLocation,
      deliveryLocation: shipment.deliveryLocation,
      cargoDescription: shipment.cargoDescription,
      weight: shipment.weight,
      volume: shipment.volume,
      status: shipment.status,
      assignedTruck: truck?.plateNumber ?? "Unassigned",
      assignedDriver: driver?.name ?? "Unassigned",
      pickupWindow: shipment.pickupWindow,
      requiresRefrigeration: Boolean(shipment.requiresRefrigeration),
      assignedAt: shipment.assignedAt,
      pickupConfirmedAt: shipment.pickupConfirmedAt,
      deliveryConfirmedAt: shipment.deliveryConfirmedAt,
    };
  });
}

export interface SystemHealth {
  stationsOnline: number;
  stationsOffline: number;
  trucksActive: number;
  trucksIdle: number;
  trucksMaintenance: number;
  driversActive: number;
  driversInactive: number;
  criticalAlerts: number;
  warningAlerts: number;
  averageSwapTime: number;
  averageChargingTime: number;
  networkUtilization: number;
}

export function deriveSystemHealth(
  stations: Station[],
  trucks: Truck[],
  drivers: Driver[],
  swaps: SwapTransaction[]
): SystemHealth {
  const stationsOnline = stations.filter((s) => s.status === "ACTIVE").length;
  const stationsOffline = stations.length - stationsOnline;

  const trucksActive = trucks.filter((t) => t.status === "IN_TRANSIT" || t.status === "READY").length;
  const trucksIdle = trucks.filter((t) => t.status === "IDLE").length;
  const trucksMaintenance = trucks.filter((t) => t.status === "MAINTENANCE").length;

  const driversActive = drivers.filter((d) => d.status === "ACTIVE").length;
  const driversInactive = drivers.length - driversActive;

  // Simplified metrics - in real app, these would come from backend
  const criticalAlerts = 0; // Would be calculated from incidents
  const warningAlerts = 0; // Would be calculated from incidents
  const averageSwapTime = 15; // minutes - would be calculated from swap data
  const averageChargingTime = 120; // minutes - would be calculated from charging sessions
  const networkUtilization = Math.min(
    100,
    Math.round((trucksActive / Math.max(1, trucks.length)) * 100)
  );

  return {
    stationsOnline,
    stationsOffline,
    trucksActive,
    trucksIdle,
    trucksMaintenance,
    driversActive,
    driversInactive,
    criticalAlerts,
    warningAlerts,
    averageSwapTime,
    averageChargingTime,
    networkUtilization,
  };
}
