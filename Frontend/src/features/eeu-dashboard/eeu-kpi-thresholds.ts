/**
 * KPI Thresholds for EEU Grid Operations Dashboard
 *
 * Badge status derived from values vs thresholds.
 * Plan: utilization > 85% DANGER, > 65% WARNING; revenue/load thresholds for others.
 */

import type { EeuKpis } from "./normalize";
import type { StatusVariant } from "@/components/ui/status-badge";

export const EEU_KPI_THRESHOLDS = {
  totalNetworkLoadKw: { warning: 300, danger: 400 },
  totalStationEnergyTodayKwh: { success: 1_000, warning: 100, danger: 0 },
  electricityDeliveredEtb: { success: 100_000, warning: 10_000, danger: 0 },
  eeuRevenueShareEtb: { success: 1_000_000, warning: 100_000, danger: 0 },
  activeChargingSessions: { success: 20, warning: 5, danger: 0 },
  forecastLoadNext24HoursKw: { warning: 300, danger: 400 },
  /** Utilization: high = bad. > 85% danger, > 65% warning */
  maxUtilizationPct: { danger: 85, warning: 65 },
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

/** High value = bad (e.g. load). value >= danger -> danger, >= warning -> warning */
function statusFromHighBad(
  value: number,
  thresholds: { warning?: number; danger?: number }
): StatusVariant {
  const { warning, danger } = thresholds;
  if (danger != null && value >= danger) return "danger";
  if (warning != null && value >= warning) return "warning";
  return "success";
}

/** Utilization: higher is worse. > 85% danger, > 65% warning, else success/info */
function statusFromUtilization(pct: number): StatusVariant {
  if (pct >= (EEU_KPI_THRESHOLDS.maxUtilizationPct.danger ?? 85)) return "danger";
  if (pct >= (EEU_KPI_THRESHOLDS.maxUtilizationPct.warning ?? 65)) return "warning";
  return "success";
}

/** Peak load station is informational; use same as max utilization for consistency */
function statusPeakLoadStation(maxUtilizationPct: number): StatusVariant {
  return statusFromUtilization(maxUtilizationPct);
}

export function deriveEeuKpiStatus(kpis: EeuKpis): Record<keyof EeuKpis, StatusVariant> {
  const t = EEU_KPI_THRESHOLDS;
  return {
    totalNetworkLoadKw: statusFromHighBad(kpis.totalNetworkLoadKw, t.totalNetworkLoadKw),
    totalStationEnergyTodayKwh: statusFromThreshold(
      kpis.totalStationEnergyTodayKwh,
      t.totalStationEnergyTodayKwh
    ),
    electricityDeliveredEtb: statusFromThreshold(kpis.electricityDeliveredEtb, t.electricityDeliveredEtb),
    eeuRevenueShareEtb: statusFromThreshold(kpis.eeuRevenueShareEtb, t.eeuRevenueShareEtb),
    activeChargingSessions: statusFromThreshold(
      kpis.activeChargingSessions,
      t.activeChargingSessions
    ),
    peakLoadStation: statusPeakLoadStation(kpis.maxUtilizationPct),
    forecastLoadNext24HoursKw: statusFromHighBad(
      kpis.forecastLoadNext24HoursKw,
      t.forecastLoadNext24HoursKw
    ),
    maxUtilizationPct: statusFromUtilization(kpis.maxUtilizationPct),
  };
}
