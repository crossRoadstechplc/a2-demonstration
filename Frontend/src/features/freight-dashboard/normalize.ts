import type { Shipment } from "@/types/shipment";
import type { Truck } from "@/types/truck";

export interface FreightKpis {
  totalShipments: number;
  activeShipments: number;
  deliveredShipments: number;
  estimatedSpendEtb: number;
  refrigeratedShipments: number;
  pendingDeliveryConfirmations: number;
}

export interface TrackingEvent {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  status: "done" | "active" | "pending";
}

function numberFrom(input: unknown, keys: string[]): number {
  if (!input || typeof input !== "object") return 0;
  const source = input as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function estimateFreightPrice(params: {
  weight: number;
  volume: number;
  requiresRefrigeration: boolean;
}): number {
  const base = params.weight * 8 + params.volume * 3.5 + 120;
  const refrigeration = params.requiresRefrigeration ? 90 : 0;
  return Math.max(0, Math.round(base + refrigeration));
}

export function deriveFreightKpis(shipments: Shipment[], freightSummaryPayload: unknown): FreightKpis {
  const totalShipments = shipments.length;
  const activeShipments = shipments.filter((shipment) =>
    ["REQUESTED", "ASSIGNED", "IN_TRANSIT"].includes(shipment.status)
  ).length;
  const deliveredShipments = shipments.filter((shipment) => shipment.status === "DELIVERED").length;
  const refrigeratedShipments = shipments.filter((shipment) => shipment.requiresRefrigeration === 1).length;
  const pendingDeliveryConfirmations = shipments.filter(
    (shipment) => shipment.status === "DELIVERED" && !shipment.deliveryConfirmedAt
  ).length;

  const estimatedSpendFromApi = numberFrom(freightSummaryPayload, ["estimatedSpend", "estimatedSpendEtb"]);
  const estimatedSpendFromShipments = shipments.reduce(
    (sum, shipment) =>
      sum +
      estimateFreightPrice({
        weight: shipment.weight,
        volume: shipment.volume,
        requiresRefrigeration: shipment.requiresRefrigeration === 1,
      }),
    0
  );

  return {
    totalShipments,
    activeShipments,
    deliveredShipments,
    estimatedSpendEtb: estimatedSpendFromApi || estimatedSpendFromShipments,
    refrigeratedShipments,
    pendingDeliveryConfirmations,
  };
}

export function deriveAvailableTrucks(trucks: Truck[]): Truck[] {
  return [...trucks]
    .filter(
      (truck) =>
        (truck.availability || "").toUpperCase().includes("AVAILABLE") ||
        ["READY", "IDLE"].includes((truck.status || "").toUpperCase())
    )
    .sort((a, b) => b.currentSoc - a.currentSoc)
    .slice(0, 6);
}

export function deriveTrackingEvents(trackingPayload: unknown, shipment?: Shipment): TrackingEvent[] {
  const timeline =
    (trackingPayload as Record<string, unknown> | undefined)?.timeline ||
    (trackingPayload as Record<string, unknown> | undefined)?.events;
  if (Array.isArray(timeline) && timeline.length > 0) {
    return timeline.slice(0, 8).map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const status = String(row.status ?? "").toLowerCase();
      return {
        id: `tracking-${index}`,
        title: String(row.eventType ?? row.title ?? "Tracking update"),
        detail: String(row.message ?? row.note ?? ""),
        timestamp: String(row.timestamp ?? row.time ?? "now"),
        status: status.includes("done") || status.includes("complete") ? "done" : status.includes("active") ? "active" : "pending",
      };
    });
  }

  if (!shipment) return [];

  const rows: TrackingEvent[] = [
    {
      id: "confirmed",
      title: "Order Confirmed",
      detail: shipment.pickupLocation,
      timestamp: shipment.assignedAt ?? "pending",
      status: shipment.status === "REQUESTED" ? "active" : "done",
    },
    {
      id: "pickup",
      title: "Pickup Completed",
      detail: shipment.pickupLocation,
      timestamp: shipment.pickupConfirmedAt ?? "pending",
      status: shipment.pickupConfirmedAt ? "done" : shipment.status === "ASSIGNED" ? "active" : "pending",
    },
    {
      id: "enroute",
      title: "En Route",
      detail: shipment.deliveryLocation,
      timestamp: shipment.acceptedAt ?? "pending",
      status: shipment.status === "IN_TRANSIT" ? "active" : shipment.status === "DELIVERED" ? "done" : "pending",
    },
    {
      id: "delivery",
      title: "Delivery",
      detail: shipment.deliveryLocation,
      timestamp: shipment.deliveryConfirmedAt ?? "pending",
      status: shipment.deliveryConfirmedAt ? "done" : "pending",
    },
  ];

  return rows;
}
