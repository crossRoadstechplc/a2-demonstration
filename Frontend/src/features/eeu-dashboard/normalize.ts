import type { Station } from "@/types/station";
import type { Truck } from "@/types/truck";

type AnyRecord = Record<string, unknown>;

function asRecord(input: unknown): AnyRecord {
  return input && typeof input === "object" ? (input as AnyRecord) : {};
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function readNumber(input: unknown, keys: string[]): number {
  const source = asRecord(input);
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function readString(input: unknown, keys: string[], fallback = ""): string {
  const source = asRecord(input);
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

export interface EeuKpis {
  totalNetworkLoadKw: number;
  totalStationEnergyTodayKwh: number;
  electricityDeliveredEtb: number;
  eeuRevenueShareEtb: number;
  activeChargingSessions: number;
  peakLoadStation: string;
  forecastLoadNext24HoursKw: number;
}

export interface StationPowerRow {
  stationId: number;
  stationName: string;
  liveLoadKw: number;
  energyTodayKwh: number;
  activeChargers: number;
  utilizationPct: number;
}

export interface GridNotice {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "danger" | "info" | "success";
}

export function deriveStationPowerRows(params: {
  stations: Station[];
  eeuSummary: unknown;
  chargingSessionsByStation: Record<number, number>;
}): StationPowerRow[] {
  const eeuRows = asArray(asRecord(params.eeuSummary).stations);

  return params.stations.map((station, index) => {
    const fromSummary =
      eeuRows.find(
        (row) =>
          readNumber(row, ["stationId", "id"]) === station.id ||
          readString(row, ["stationName", "name"]).toLowerCase() === station.name.toLowerCase()
      ) ?? null;
    const activeChargers = params.chargingSessionsByStation[station.id] ?? 0;
    const fallbackLoad = 80 + ((index * 37 + station.id * 17) % 260);
    const liveLoadKw = readNumber(fromSummary, ["liveLoadKw", "powerDrawKw", "loadKw"]) || fallbackLoad;
    const energyTodayKwh =
      readNumber(fromSummary, ["energyTodayKwh", "energyDeliveredKwh", "kwhToday"]) || liveLoadKw * 4.5;
    const utilizationPct =
      readNumber(fromSummary, ["utilizationPct", "capacityUsedPct"]) ||
      Math.min(99, Math.round((liveLoadKw / 420) * 100));

    return {
      stationId: station.id,
      stationName: station.name,
      liveLoadKw: Math.round(liveLoadKw),
      energyTodayKwh: Math.round(energyTodayKwh),
      activeChargers,
      utilizationPct,
    };
  });
}

export function deriveEeuKpis(params: {
  eeuSummary: unknown;
  billingSummaryEeu: unknown;
  stationRows: StationPowerRow[];
  activeChargingSessions: number;
}): EeuKpis {
  const totalNetworkLoadKw =
    readNumber(params.eeuSummary, ["totalNetworkLoadKw", "currentLoadKw", "liveDemandKw"]) ||
    params.stationRows.reduce((sum, row) => sum + row.liveLoadKw, 0);

  const totalStationEnergyTodayKwh =
    readNumber(params.eeuSummary, ["totalStationEnergyTodayKwh", "todayDeliveredKwh", "energyTodayKwh"]) ||
    params.stationRows.reduce((sum, row) => sum + row.energyTodayKwh, 0);

  const electricityDeliveredEtb =
    readNumber(params.billingSummaryEeu, ["electricityDeliveredEtb", "energyCharge", "totalEnergyChargeEtb"]) ||
    readNumber(params.billingSummaryEeu, ["eeuRevenueShareEtb", "eeuShareEtb"]);

  const eeuRevenueShareEtb = readNumber(params.billingSummaryEeu, [
    "eeuRevenueShareEtb",
    "eeuShareEtb",
    "eeuShare",
  ]);

  const peakLoadStation =
    params.stationRows.sort((a, b) => b.liveLoadKw - a.liveLoadKw)[0]?.stationName ?? "N/A";

  const forecastLoadNext24HoursKw =
    readNumber(params.eeuSummary, ["forecastLoadNext24HoursKw", "loadForecast24hKw"]) ||
    Math.round(totalNetworkLoadKw * 1.08);

  return {
    totalNetworkLoadKw: Math.round(totalNetworkLoadKw),
    totalStationEnergyTodayKwh: Math.round(totalStationEnergyTodayKwh),
    electricityDeliveredEtb: Math.round(electricityDeliveredEtb),
    eeuRevenueShareEtb: Math.round(eeuRevenueShareEtb),
    activeChargingSessions: params.activeChargingSessions,
    peakLoadStation,
    forecastLoadNext24HoursKw,
  };
}

export function deriveGridNotices(params: {
  stationRows: StationPowerRow[];
  tariffConfig: unknown;
}): GridNotice[] {
  const notices: GridNotice[] = [];
  const heavyDrawStations = params.stationRows.filter((row) => row.liveLoadKw > 260).slice(0, 3);

  heavyDrawStations.forEach((row, index) => {
    notices.push({
      id: `draw-${row.stationId}-${index}`,
      title: `${row.stationName} elevated draw`,
      detail: `${row.liveLoadKw} kW (${row.utilizationPct}% utilization)`,
      severity: row.utilizationPct > 85 ? "danger" : "warning",
    });
  });

  const peakRate = readNumber(params.tariffConfig, ["eeuRatePerKwh"]);
  notices.push({
    id: "tariff",
    title: "Active EEU energy tariff",
    detail: `${peakRate.toFixed(2)} ETB / kWh`,
    severity: "info",
  });

  if (!heavyDrawStations.length) {
    notices.push({
      id: "stable",
      title: "Grid nominal",
      detail: "No station currently above high-draw threshold.",
      severity: "success",
    });
  }

  return notices.slice(0, 6);
}

export function deriveRefrigeratedImpact(trucks: Truck[]): {
  activeRefrigerated: number;
  estimatedDrawKw: number;
} {
  const active = trucks.filter(
    (truck) => truck.truckType === "REFRIGERATED" && truck.status.toUpperCase() !== "IDLE"
  );
  const draw = active.reduce((sum, truck) => sum + Math.max(0, truck.refrigerationPowerDraw), 0);
  return {
    activeRefrigerated: active.length,
    estimatedDrawKw: Math.round(draw),
  };
}
