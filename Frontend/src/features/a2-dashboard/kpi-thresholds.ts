/**
 * KPI Thresholds for A2 Dashboard
 *
 * Badge status is derived from actual values vs these thresholds:
 * - SUCCESS: value meets or exceeds target (healthy)
 * - WARNING: value is below target but above critical
 * - DANGER: value is critically low
 * - INFO: informational (no strong good/bad signal)
 * - NEUTRAL: fallback when thresholds don't apply
 */

import type { A2Kpis } from "./normalize";
import type { StatusVariant } from "@/components/ui/status-badge";

export const KPI_THRESHOLDS = {
  /** Active Trucks: target ~1000-2000 for corridor operations */
  activeTrucks: { success: 100, warning: 50, danger: 10 },
  /** Swaps Today: target 500+ for healthy corridor, 25M+ revenue needs ~5000 */
  swapsToday: { success: 500, warning: 100, danger: 10 },
  /** Batteries Ready: target 100+ (30%+ of ~2500 total), 0 = critical */
  batteriesReady: { success: 100, warning: 10, danger: 1 },
  /** Charging Active: healthy = 50+ sessions, some activity = 5+ */
  chargingSessionsActive: { success: 50, warning: 5, danger: 1 },
  /** Corridor Energy Today (kWh): target 100k+ (800 swaps × ~125 kWh avg) */
  corridorEnergyToday: { success: 100_000, warning: 10_000, danger: 1_000 },
  /** Corridor Revenue (ETB): target 25M-30M daily */
  corridorRevenueEtb: { success: 10_000_000, warning: 1_000_000, danger: 100_000 },
  /** A2 Share (ETB): target ~12.5M at 25M total */
  a2ShareEtb: { success: 1_000_000, warning: 100_000, danger: 10_000 },
  /** EEU Share (ETB): target ~12.5M at 25M total */
  eeuShareEtb: { success: 1_000_000, warning: 100_000, danger: 10_000 },
  /** VAT Collected (ETB): ~15% of revenue, target ~3.75M at 25M */
  vatCollectedEtb: { success: 1_000_000, warning: 100_000, danger: 10_000 },
  /** Stations Online: 7 total in corridor */
  stationsOnline: { success: 6, warning: 3, danger: 1 },
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

/** Derive badge status for each KPI based on thresholds */
export function deriveKpiStatus(kpis: A2Kpis): Record<keyof A2Kpis, StatusVariant> {
  const t = KPI_THRESHOLDS;
  return {
    activeTrucks: statusFromThreshold(kpis.activeTrucks, t.activeTrucks),
    swapsToday: statusFromThreshold(kpis.swapsToday, t.swapsToday),
    batteriesReady: statusFromThreshold(kpis.batteriesReady, t.batteriesReady),
    chargingSessionsActive: statusFromThreshold(
      kpis.chargingSessionsActive,
      t.chargingSessionsActive
    ),
    corridorEnergyToday: statusFromThreshold(
      kpis.corridorEnergyToday,
      t.corridorEnergyToday
    ),
    corridorRevenueEtb: statusFromThreshold(
      kpis.corridorRevenueEtb,
      t.corridorRevenueEtb
    ),
    a2ShareEtb: statusFromThreshold(kpis.a2ShareEtb, t.a2ShareEtb),
    eeuShareEtb: statusFromThreshold(kpis.eeuShareEtb, t.eeuShareEtb),
    vatCollectedEtb: statusFromThreshold(kpis.vatCollectedEtb, t.vatCollectedEtb),
    stationsOnline: statusFromThreshold(kpis.stationsOnline, t.stationsOnline),
  };
}

/** Human-readable thresholds for the reference note */
export const KPI_THRESHOLDS_NOTE = `KPI Badge Thresholds (SUCCESS / WARNING / DANGER / INFO):

• Active Trucks: ≥100 SUCCESS, ≥50 WARNING, <10 DANGER
• Swaps Today: ≥500 SUCCESS, ≥100 WARNING, <10 DANGER
• Batteries Ready: ≥100 SUCCESS, ≥10 WARNING, <1 DANGER
• Charging Active: ≥50 SUCCESS, ≥5 WARNING, <1 DANGER
• Corridor Energy (kWh/day): ≥100k SUCCESS, ≥10k WARNING, <1k DANGER
• Corridor Revenue: ≥10M ETB SUCCESS, ≥1M WARNING, <100k DANGER
• A2 Share / EEU Share / VAT: ≥1M SUCCESS, ≥100k WARNING, <10k DANGER
• Stations Online: ≥6 SUCCESS, ≥3 WARNING, <1 DANGER

Targets: 2000 trucks, 2500–3000 batteries, 25M–30M ETB daily revenue, 7 stations.`;
