/**
 * Shared types for simulation phases
 */

export interface StationRow {
  id: number;
  name: string;
}

export interface TruckRow {
  id: number;
  truckType: string;
  batteryId: string;
  status: string;
  currentSoc: number;
  refrigerationPowerDraw: number;
  currentStationId: number | null;
  locationLat: number | null;
  locationLng: number | null;
  assignedDriverId: number | null;
}

export interface BatteryRow {
  id: number;
  capacityKwh: number;
  soc: number;
  status: string;
  stationId: number | null;
  truckId: number | null;
}

export interface DriverRow {
  id: number;
  fleetId: number;
  assignedTruckId: number | null;
  speedViolations: number;
  harshBrakes: number;
  safetyScore: number;
  completedTrips: number;
}

export interface ShipmentRow {
  id: number;
  status: string;
  truckId: number | null;
  driverId: number | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TruckMotionState {
  fromStationId: number;
  toStationId: number;
  progress: number;
}

export interface ScenarioModifiers {
  truckMovementMultiplier?: number;
  socDrainMultiplier?: number;
  swapFrequencyMultiplier?: number;
  readyBatteryAvailabilityMultiplier?: number;
  chargingRateMultiplier?: number;
  chargerAvailabilityMultiplier?: number;
  queueBuildUpMultiplier?: number;
  queueThreshold?: number;
  shipmentGenerationMultiplier?: number;
  refrigeratedShipmentMultiplier?: number;
  freightCompletionMultiplier?: number;
  incidentGenerationMultiplier?: number;
  chargerFaultMultiplier?: number;
  networkLoadMultiplier?: number;
  gridNoticeProbability?: number;
  targetStationIds?: number[];
}

export interface SimulationContext {
  timestamp: string;
  stations: StationRow[];
  stationIds: number[];
  stationById: Map<number, StationRow>;
  truckMotionById: Map<number, TruckMotionState>;
  scenarioModifiers: ScenarioModifiers;
}

export interface PhaseResult {
  success: boolean;
  error?: string;
}
