export interface Battery {
  id: number;
  capacityKwh: number;
  soc: number;
  health: number;
  cycleCount: number;
  temperature: number;
  status: "READY" | "CHARGING" | "IN_TRUCK" | "MAINTENANCE";
  stationId: number | null;
  truckId: number | null;
}
