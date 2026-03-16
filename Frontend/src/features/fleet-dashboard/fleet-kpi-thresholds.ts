/**
 * KPI Thresholds for Fleet Dashboard
 *
 * Badge status is derived from actual values vs these thresholds.
 * Fleet-level targets are lower than corridor-wide A2 targets.
 */

import type { FleetKpis } from "./normalize";
import type { StatusVariant } from "@/components/ui/status-badge";

export const FLEET_KPI_THRESHOLDS = {
  activeTrucks: { success: 50, warning: 10, danger: 0 },
  availableTrucks: { success: 20, warning: 5, danger: 0 },
  activeDrivers: { success: 10, warning: 2, danger: 0 },
  swapsToday: { success: 10, warning: 2, danger: 0 },
  fleetEnergyCostEtb: { success: 50_000, warning: 5_000, danger: 0 },
  completedTrips: { success: 5, warning: 1, danger: 0 },
  maintenanceAlerts: { danger: 1, warning: 0, success: 0 },
  refrigeratedTrucksActive: { success: 5, warning: 1, danger: 0 },
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

/** Maintenance: 0 = success, 1+ = warning/danger */
function statusMaintenance(count: number): StatusVariant {
  if (count === 0) return "success";
  if (count <= 2) return "warning";
  return "danger";
}

/** Derive badge status for each fleet KPI */
export function deriveFleetKpiStatus(kpis: FleetKpis): Record<keyof FleetKpis, StatusVariant> {
  const t = FLEET_KPI_THRESHOLDS;
  return {
    activeTrucks: statusFromThreshold(kpis.activeTrucks, t.activeTrucks),
    availableTrucks: statusFromThreshold(kpis.availableTrucks, t.availableTrucks),
    activeDrivers: statusFromThreshold(kpis.activeDrivers, t.activeDrivers),
    swapsToday: statusFromThreshold(kpis.swapsToday, t.swapsToday),
    fleetEnergyCostEtb: statusFromThreshold(kpis.fleetEnergyCostEtb, t.fleetEnergyCostEtb),
    completedTrips: statusFromThreshold(kpis.completedTrips, t.completedTrips),
    maintenanceAlerts: statusMaintenance(kpis.maintenanceAlerts),
    refrigeratedTrucksActive: statusFromThreshold(
      kpis.refrigeratedTrucksActive,
      t.refrigeratedTrucksActive
    ),
  };
}
