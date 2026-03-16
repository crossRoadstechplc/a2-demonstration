/**
 * KPI Thresholds for Freight Dashboard
 *
 * Badge status derived from values vs thresholds.
 * Plan: Delivered >= 5 SUCCESS, Active >= 1 INFO; pending confirmations 0 = success.
 */

import type { FreightKpis } from "./normalize";
import type { StatusVariant } from "@/components/ui/status-badge";

export const FREIGHT_KPI_THRESHOLDS = {
  totalShipments: { success: 5, warning: 1, danger: 0 },
  activeShipments: { success: 3, warning: 1, danger: 0 },
  deliveredShipments: { success: 5, warning: 1, danger: 0 },
  estimatedSpendEtb: { success: 10_000, warning: 1_000, danger: 0 },
  refrigeratedShipments: { success: 2, warning: 0, danger: 0 },
  pendingDeliveryConfirmations: { danger: 1, warning: 0, success: 0 },
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

/** Pending confirmations: 0 = success, 1+ = warning/danger */
function statusPendingConfirmations(count: number): StatusVariant {
  if (count === 0) return "success";
  if (count <= 2) return "warning";
  return "danger";
}

export function deriveFreightKpiStatus(kpis: FreightKpis): Record<keyof FreightKpis, StatusVariant> {
  const t = FREIGHT_KPI_THRESHOLDS;
  return {
    totalShipments: statusFromThreshold(kpis.totalShipments, t.totalShipments),
    activeShipments: statusFromThreshold(kpis.activeShipments, t.activeShipments),
    deliveredShipments: statusFromThreshold(kpis.deliveredShipments, t.deliveredShipments),
    estimatedSpendEtb: statusFromThreshold(kpis.estimatedSpendEtb, t.estimatedSpendEtb),
    refrigeratedShipments: statusFromThreshold(kpis.refrigeratedShipments, t.refrigeratedShipments),
    pendingDeliveryConfirmations: statusPendingConfirmations(kpis.pendingDeliveryConfirmations),
  };
}
