import type { Driver } from "@/types/driver";
import type { Fleet } from "@/types/fleet";
import type { Shipment } from "@/types/shipment";
import type { SwapTransaction } from "@/types/swap";
import type { Truck } from "@/types/truck";

export interface FleetKpis {
  activeTrucks: number;
  availableTrucks: number;
  activeDrivers: number;
  swapsToday: number;
  fleetEnergyCostEtb: number;
  completedTrips: number;
  maintenanceAlerts: number;
  refrigeratedTrucksActive: number;
}

function readNumber(input: unknown, keys: string[]): number {
  if (!input || typeof input !== "object") return 0;
  const source = input as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function resolveFleetId(params: {
  fleets: Fleet[];
  preferredFleetId: number;
  organizationId: string | null | undefined;
}): number {
  const { fleets, preferredFleetId, organizationId } = params;
  if (!fleets.length) return preferredFleetId;

  const orgFleetId = Number(organizationId);
  if (Number.isFinite(orgFleetId) && fleets.some((fleet) => fleet.id === orgFleetId)) {
    return orgFleetId;
  }

  if (fleets.some((fleet) => fleet.id === preferredFleetId)) {
    return preferredFleetId;
  }
  return fleets[0].id;
}

export function deriveFleetKpis(params: {
  trucks: Truck[];
  drivers: Driver[];
  swaps: SwapTransaction[];
  shipments: Shipment[];
  billingSummaryFleets: unknown;
  selectedFleetId: number;
}): FleetKpis {
  const { trucks, drivers, swaps, shipments, billingSummaryFleets, selectedFleetId } = params;
  const fleetTrucks = trucks.filter((truck) => truck.fleetId === selectedFleetId);
  const fleetDrivers = drivers.filter((driver) => driver.fleetId === selectedFleetId);
  const truckIds = new Set(fleetTrucks.map((truck) => truck.id));

  const swapsToday = swaps.filter((swap) => truckIds.has(swap.truckId)).length;
  const activeTrucks = fleetTrucks.filter((truck) => truck.status.toUpperCase() !== "IDLE").length;
  const availableTrucks = fleetTrucks.filter(
    (truck) =>
      (truck.availability || "").toUpperCase().includes("AVAILABLE") ||
      (truck.status || "").toUpperCase() === "READY"
  ).length;
  const activeDrivers = fleetDrivers.filter((driver) => driver.status.toUpperCase() === "ACTIVE").length;
  const completedTrips = shipments.filter(
    (shipment) => shipment.status === "DELIVERED" && shipment.truckId && truckIds.has(shipment.truckId)
  ).length;
  const maintenanceAlerts = fleetTrucks.filter(
    (truck) => truck.status.toUpperCase() === "MAINTENANCE" || truck.currentSoc < 20
  ).length;
  const refrigeratedTrucksActive = fleetTrucks.filter(
    (truck) => truck.truckType === "REFRIGERATED" && truck.status.toUpperCase() !== "IDLE"
  ).length;

  // Backend returns { revenueByFleet: [...] } with totalRevenueEtb field
  const summaryRows = Array.isArray((billingSummaryFleets as Record<string, unknown> | undefined)?.revenueByFleet)
    ? (((billingSummaryFleets as Record<string, unknown>).revenueByFleet as unknown[]) ?? [])
    : Array.isArray((billingSummaryFleets as Record<string, unknown> | undefined)?.fleets)
      ? (((billingSummaryFleets as Record<string, unknown>).fleets as unknown[]) ?? [])
      : [];
  const matchedSummaryRow = summaryRows.find((row) => {
    const fleetId = readNumber(row, ["fleetId", "id"]);
    return fleetId === selectedFleetId;
  });

  // totalRevenueEtb is the total cost the fleet pays (energy + service + VAT)
  const fleetEnergyCostEtb =
    readNumber(matchedSummaryRow, ["totalRevenueEtb", "energyCostEtb", "totalEnergyCost", "energyCost"]) ||
    readNumber(billingSummaryFleets, ["totalRevenueEtb", "energyCostEtb", "totalEnergyCost", "energyCost"]);

  return {
    activeTrucks,
    availableTrucks,
    activeDrivers,
    swapsToday,
    fleetEnergyCostEtb,
    completedTrips,
    maintenanceAlerts,
    refrigeratedTrucksActive,
  };
}
