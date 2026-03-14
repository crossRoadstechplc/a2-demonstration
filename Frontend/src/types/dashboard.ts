export interface A2DashboardSummary {
  activeTrucks: number;
  swapsToday: number;
  batteriesReady: number;
  energyToday: number;
  incidents: number;
  stationsOnline: number;
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
}
