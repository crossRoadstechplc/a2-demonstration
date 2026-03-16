import type { Battery } from "@/types/battery";
import type { ChargerFault, Station, StationIncident } from "@/types/station";
import type { SwapTransaction } from "@/types/swap";
import type { Truck } from "@/types/truck";

type ChargingSession = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function readNumber(value: unknown, keys: string[]): number {
  const source = asRecord(value);
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 0;
}

function readString(value: unknown, keys: string[], fallback = ""): string {
  const source = asRecord(value);
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return fallback;
}

export interface StationKpis {
  totalBatteries: number;
  readyBatteries: number;
  chargingBatteries: number;
  trucksAtStation: number;
  swapsToday: number;
  energyConsumedToday: number;
  energyChargingNow: number;
  revenueTodayEtb: number;
  revenueThisMonthEtb: number;
  chargerFaultsOpen: number;
  queueSize: number;
}

export interface ChargerStatusRow {
  chargerId: string;
  status: string;
  outputKw: number;
}

export interface IncomingPrediction {
  truckLabel: string;
  eta: string;
  estimatedSoc: number;
}

export function filterStationBatteries(
  batteries: Battery[],
  stationId: number,
  statusFilter: string
): Battery[] {
  const atStation = batteries.filter((item) => item.stationId === stationId);
  if (statusFilter === "ALL") {
    return atStation;
  }
  return atStation.filter((item) => item.status === statusFilter);
}

export function deriveStationKpis(params: {
  stationSummary: unknown;
  stationBatteries: Battery[];
  chargingSessions: ChargingSession[];
  swaps: SwapTransaction[];
  faults: ChargerFault[];
  trucksAtStation: Truck[];
}): StationKpis {
  const {
    stationSummary,
    stationBatteries,
    chargingSessions,
    swaps,
    faults,
    trucksAtStation,
  } = params;

  const todaySwapCountFromSummary = readNumber(stationSummary, [
    "swapsToday",
    "todaySwaps",
  ]);
  const queueSizeFromSummary = readNumber(stationSummary, ["queueSize", "trucksInQueue"]);
  const energyFromSummary = readNumber(stationSummary, [
    "energyConsumedToday",
    "energyToday",
    "energyKwh",
  ]);
  const trucksFromSummary = readNumber(stationSummary, [
    "trucksAtStationCount",
    "trucksAtStation",
  ]);

  const readyBatteries = stationBatteries.filter((item) => item.status === "READY").length;
  const chargingBatteries = stationBatteries.filter((item) => item.status === "CHARGING").length;
  const openFaults = faults.filter((item) => item.status.toUpperCase() !== "RESOLVED").length;
  const activeChargingSessions = chargingSessions.filter((session) => {
    const status = readString(session, ["status"], "").toUpperCase();
    return !status || status === "ACTIVE";
  });
  const chargingEnergy = activeChargingSessions.reduce(
    (sum, session) => sum + readNumber(session, ["energyAddedKwh"]),
    0
  );

  const revenueTodayEtb = readNumber(stationSummary, [
    "revenueTodayEtb",
    "revenueToday",
  ]);
  const revenueThisMonthEtb = readNumber(stationSummary, [
    "revenueThisMonthEtb",
    "revenueThisMonth",
  ]);
  const energyChargingNow = readNumber(stationSummary, [
    "energyChargingNowKwh",
    "energyChargingNow",
  ]);

  return {
    totalBatteries: stationBatteries.length,
    readyBatteries,
    chargingBatteries,
    trucksAtStation: trucksFromSummary || trucksAtStation.length,
    swapsToday: todaySwapCountFromSummary || swaps.length,
    energyConsumedToday: energyFromSummary || chargingEnergy,
    energyChargingNow: energyChargingNow || chargingEnergy,
    revenueTodayEtb,
    revenueThisMonthEtb,
    chargerFaultsOpen: openFaults,
    queueSize: queueSizeFromSummary,
  };
}

export function deriveChargerStatuses(
  faults: ChargerFault[],
  stationSummary: unknown,
  statusFilter: string
): ChargerStatusRow[] {
  const summaryRows = asRecord(stationSummary).chargerStatus;
  const fromSummary = Array.isArray(summaryRows)
    ? summaryRows.map((row, index) => ({
        chargerId: readString(row, ["chargerId"], `CHG-${String(index + 1).padStart(2, "0")}`),
        status: readString(row, ["status"], "READY"),
        outputKw: readNumber(row, ["outputKw", "powerKw"]),
      }))
    : [];

  const faultRows = faults.map((fault) => ({
    chargerId: fault.chargerId,
    status: fault.status.toUpperCase() === "OPEN" ? "FAULT" : "READY",
    outputKw: 0,
  }));

  const merged = [...fromSummary, ...faultRows];
  const uniqueByCharger = new Map<string, ChargerStatusRow>();
  merged.forEach((row) => uniqueByCharger.set(row.chargerId, row));

  const rows = Array.from(uniqueByCharger.values());
  if (statusFilter === "ALL") {
    return rows;
  }
  return rows.filter((row) => row.status.toUpperCase() === statusFilter.toUpperCase());
}

export function deriveIncomingPredictions(stationSummary: unknown): IncomingPrediction[] {
  const predictions = asRecord(stationSummary).incomingPredictions;
  if (!Array.isArray(predictions)) {
    return [];
  }

  return predictions.map((row, index) => ({
    truckLabel: readString(row, ["truckId", "truckLabel"], `TRK-${1000 + index}`),
    eta: readString(row, ["eta", "etaText"], "~15 min"),
    estimatedSoc: readNumber(row, ["estimatedSoc", "soc"]),
  }));
}

export function sortIncidentsBySeverity(incidents: StationIncident[]): StationIncident[] {
  const weight = (severity: string) => {
    const value = severity.toUpperCase();
    if (value === "CRITICAL") return 4;
    if (value === "HIGH") return 3;
    if (value === "MEDIUM") return 2;
    return 1;
  };
  return [...incidents].sort((a, b) => weight(b.severity) - weight(a.severity));
}

export function resolveStation(
  stations: Station[],
  selectedStationId: number
): Station | undefined {
  return stations.find((station) => station.id === selectedStationId);
}
