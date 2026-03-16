/**
 * KPI Thresholds for Station Dashboard
 * Badge status derived from values vs thresholds (SUCCESS / WARNING / DANGER / INFO).
 */

import type { StationKpis } from "./normalize";
import type { StatusVariant } from "@/components/ui/status-badge";

export const STATION_KPI_THRESHOLDS = {
  totalBatteries: { success: 50, warning: 20, danger: 5 },
  readyBatteries: { success: 10, warning: 5, danger: 1 },
  chargingBatteries: { success: 5, warning: 1, danger: 0 },
  trucksAtStation: { success: 2, warning: 1, danger: 0 },
  swapsToday: { success: 20, warning: 5, danger: 0 },
  energyConsumedToday: { success: 5000, warning: 1000, danger: 0 },
  energyChargingNow: { success: 500, warning: 100, danger: 0 },
  revenueTodayEtb: { success: 100_000, warning: 10_000, danger: 0 },
  revenueThisMonthEtb: { success: 1_000_000, warning: 100_000, danger: 0 },
  chargerFaultsOpen: { danger: 1 }, // any open fault = danger; 0 = success
  queueSize: { warning: 4 }, // > 4 = warning
} as const;

function statusFromThreshold(
  value: number,
  thresholds: { success?: number; warning?: number; danger?: number }
): StatusVariant {
  const { success, warning, danger } = thresholds;
  if (success != null && value >= success) return "success";
  if (danger != null && value < danger) return "danger";
  if (warning != null && value >= warning) return "warning";
  return "info";
}

/** For chargerFaultsOpen: 0 = success, >= 1 = danger */
function statusChargerFaults(open: number): StatusVariant {
  return open === 0 ? "success" : "danger";
}

/** For queueSize: <= 4 = neutral, > 4 = warning */
function statusQueueSize(size: number): StatusVariant {
  return size > 4 ? "warning" : "neutral";
}

export function deriveStationKpiStatus(kpis: StationKpis): Record<keyof StationKpis, StatusVariant> {
  const t = STATION_KPI_THRESHOLDS;
  return {
    totalBatteries: statusFromThreshold(kpis.totalBatteries, t.totalBatteries),
    readyBatteries: statusFromThreshold(kpis.readyBatteries, t.readyBatteries),
    chargingBatteries: statusFromThreshold(kpis.chargingBatteries, t.chargingBatteries),
    trucksAtStation: statusFromThreshold(kpis.trucksAtStation, t.trucksAtStation),
    swapsToday: statusFromThreshold(kpis.swapsToday, t.swapsToday),
    energyConsumedToday: statusFromThreshold(kpis.energyConsumedToday, t.energyConsumedToday),
    energyChargingNow: statusFromThreshold(kpis.energyChargingNow, t.energyChargingNow),
    revenueTodayEtb: statusFromThreshold(kpis.revenueTodayEtb, t.revenueTodayEtb),
    revenueThisMonthEtb: statusFromThreshold(kpis.revenueThisMonthEtb, t.revenueThisMonthEtb),
    chargerFaultsOpen: statusChargerFaults(kpis.chargerFaultsOpen),
    queueSize: statusQueueSize(kpis.queueSize),
  };
}
