export interface A2DashboardSummary {
  activeTrucks: number;
  swapsToday: number;
  batteriesReady: number;
  chargingActive: number;
  corridorEnergyToday: number;
  corridorRevenue: number;
  a2Share: number;
  eeuShare: number;
  vatCollected: number;
  stationsOnline: number;
}

export interface A2ChartsData {
  stationUtilization: Array<{
    stationId: number;
    stationName: string;
    swapsToday: number;
    utilizationPct: number;
  }>;
  batteryInventory: Array<{
    stationId: number;
    stationName: string;
    ready: number;
    charging: number;
    total: number;
  }>;
  chargingActivity: Array<{
    stationId: number;
    stationName: string;
    activeSessions: number;
  }>;
  truckMovement: Array<{ label: string; value: number }>;
}

export interface FleetEnergyByTruckData {
  energyByTruck: Array<{
    truckId: number;
    plateNumber: string;
    energyKwh: number;
  }>;
}

export interface FreightDashboardSummary {
  customerId: number;
  totalShipments: number;
  activeShipments: number;
  estimatedSpend: number;
  recentShipmentActivity: Array<{
    id: number;
    status: string;
    eventType: string;
    message: string;
    timestamp: string;
  }>;
  deliveryConfirmations: number;
  timeframe?: "daily" | "monthly" | "yearly";
}
