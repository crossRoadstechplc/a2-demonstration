export interface Station {
  id: number;
  name: string;
  location: string;
  capacity: number;
  status: string;
  maxQueueSize?: number;
  swapBayCount?: number;
  overnightChargingEnabled?: boolean | number;
  incidentThreshold?: number;
  operatingStatus?: string;
}

export interface StationIncident {
  id: number;
  stationId: number;
  type: string;
  severity: string;
  message: string;
  status: string;
  reportedAt: string;
}

export interface ChargerFault {
  id: number;
  stationId: number;
  chargerId: string;
  faultCode: string;
  message: string;
  status: string;
  reportedAt: string;
  resolvedAt: string | null;
}
