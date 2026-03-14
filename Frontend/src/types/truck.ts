export interface Truck {
  id: number;
  plateNumber: string;
  fleetId: number;
  truckType: "STANDARD" | "REFRIGERATED";
  batteryId: string;
  status: string;
  currentSoc: number;
  refrigerationPowerDraw: number;
  temperatureTarget: number;
  temperatureCurrent: number;
  currentStationId: number | null;
  assignedDriverId: number | null;
  availability: string;
  locationLat: number | null;
  locationLng: number | null;
}
