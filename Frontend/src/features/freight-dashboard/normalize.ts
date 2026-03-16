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

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getStationNameFromCoords(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return "Unknown location";
  const stations = [
    { name: "Addis Ababa (Main Hub)", lat: 8.9806, lng: 38.7578 },
    { name: "Adama", lat: 8.54, lng: 39.27 },
    { name: "Awash", lat: 8.98, lng: 40.17 },
    { name: "Mieso", lat: 9.24, lng: 40.75 },
    { name: "Dire Dawa", lat: 9.6, lng: 41.86 },
    { name: "Semera / Mille area", lat: 11.79, lng: 41.01 },
    { name: "Djibouti Port Gateway", lat: 11.58, lng: 43.15 },
  ];
  let nearest = stations[0];
  let minDist = haversineDistance(lat, lng, nearest.lat, nearest.lng);
  for (const station of stations.slice(1)) {
    const dist = haversineDistance(lat, lng, station.lat, station.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }
  return nearest.name;
}

export interface AvailableTruckWithDistance extends Truck {
  distanceKm: number | null;
  locationLabel: string;
  simulatedLat?: number | null;
  simulatedLng?: number | null;
}

function simulateTruckLocation(truck: Truck): { lat: number; lng: number } {
  // If truck has coordinates, use them
  if (truck.locationLat !== null && truck.locationLng !== null) {
    return { lat: truck.locationLat, lng: truck.locationLng };
  }

  // Simulate location based on truck ID and current station
  const stationCoords = [
    { lat: 8.9806, lng: 38.7578 }, // Addis Ababa
    { lat: 8.54, lng: 39.27 }, // Adama
    { lat: 8.98, lng: 40.17 }, // Awash
    { lat: 9.24, lng: 40.75 }, // Mieso
    { lat: 9.6, lng: 41.86 }, // Dire Dawa
    { lat: 11.79, lng: 41.01 }, // Semera
    { lat: 11.58, lng: 43.15 }, // Djibouti
  ];

  // Use currentStationId if available, otherwise use truck ID to pick a station
  const stationIndex = truck.currentStationId
    ? (truck.currentStationId - 1) % stationCoords.length
    : truck.id % stationCoords.length;

  const baseCoords = stationCoords[stationIndex];

  // Add small random offset to simulate trucks not exactly at stations
  const offsetLat = (Math.random() - 0.5) * 0.1; // ~5.5 km max offset
  const offsetLng = (Math.random() - 0.5) * 0.1;

  return {
    lat: Math.max(8.5, Math.min(12.0, baseCoords.lat + offsetLat)),
    lng: Math.max(38.5, Math.min(43.5, baseCoords.lng + offsetLng)),
  };
}

export function deriveAvailableTrucks(
  trucks: Truck[],
  pickupLat: number | null = null,
  pickupLng: number | null = null
): AvailableTruckWithDistance[] {
  const available = [...trucks]
    .filter(
      (truck) =>
        (truck.availability || "").toUpperCase().includes("AVAILABLE") ||
        ["READY", "IDLE"].includes((truck.status || "").toUpperCase())
    )
    .map((truck) => {
      // Always simulate location for display purposes
      const simulatedLocation = simulateTruckLocation(truck);
      const effectiveLat = truck.locationLat ?? simulatedLocation.lat;
      const effectiveLng = truck.locationLng ?? simulatedLocation.lng;

      const distanceKm =
        pickupLat !== null && pickupLng !== null
          ? haversineDistance(pickupLat, pickupLng, effectiveLat, effectiveLng)
          : null;

      const locationLabel = getStationNameFromCoords(effectiveLat, effectiveLng);

      return {
        ...truck,
        distanceKm,
        locationLabel,
        // Store simulated coordinates for display
        simulatedLat: truck.locationLat === null ? simulatedLocation.lat : null,
        simulatedLng: truck.locationLng === null ? simulatedLocation.lng : null,
      };
    })
    .sort((a, b) => {
      // First sort by distance (nulls last)
      if (a.distanceKm === null && b.distanceKm === null) {
        return b.currentSoc - a.currentSoc;
      }
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
        return a.distanceKm - b.distanceKm;
      }
      // Then by SOC
      return b.currentSoc - a.currentSoc;
    })
    .slice(0, 6);
  return available;
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
