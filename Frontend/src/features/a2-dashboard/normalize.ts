import type { A2DashboardSummary } from "@/types/dashboard";
import type { LiveFeedEventGroup } from "@/types/live-feed";

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
  const chargingStarts = asArray(liveFeed?.chargingStarts).length;
  const chargingCompletions = asArray(liveFeed?.chargingCompletions).length;

  return {
    activeTrucks: a2Summary?.activeTrucks ?? 0,
    swapsToday: a2Summary?.swapsToday ?? 0,
    batteriesReady: a2Summary?.batteriesReady ?? 0,
    chargingSessionsActive: Math.max(0, chargingStarts - chargingCompletions),
    corridorEnergyToday: a2Summary?.energyToday ?? 0,
    corridorRevenueEtb: readNumber(billingSummaryA2, [
      "totalRevenue",
      "totalRevenueEtb",
      "grossRevenueEtb",
    ]),
    a2ShareEtb: readNumber(billingSummaryA2, ["a2Share", "a2ShareEtb", "totalA2ShareEtb"]),
    eeuShareEtb: readNumber(billingSummaryA2, ["eeuShare", "eeuShareEtb", "totalEeuShareEtb"]),
    vatCollectedEtb: readNumber(billingSummaryA2, ["vatCollected", "vatCollectedEtb", "totalVatEtb"]),
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
