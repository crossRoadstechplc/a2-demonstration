export interface Driver {
  id: number;
  name: string;
  phone: string;
  fleetId: number;
  rating: number;
  status: string;
  overallRating: number;
  customerRating: number;
  safetyScore: number;
  speedViolations: number;
  harshBrakes: number;
  tripEfficiency: number;
  completedTrips: number;
  assignedTruckId: number | null;
}
