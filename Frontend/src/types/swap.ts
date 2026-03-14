export interface SwapTransaction {
  id: number;
  truckId: number;
  stationId: number;
  incomingBatteryId: number;
  outgoingBatteryId: number;
  arrivalSoc: number;
  energyDeliveredKwh: number;
  timestamp: string;
}
