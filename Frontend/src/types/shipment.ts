export interface Shipment {
  id: number;
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLocation: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  cargoDescription: string;
  weight: number;
  volume: number;
  pickupWindow: string;
  requiresRefrigeration: number;
  temperatureTarget: number | null;
  customerId: number | null;
  truckId: number | null;
  driverId: number | null;
  approvedLoad: number;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickupConfirmedAt: string | null;
  deliveryConfirmedAt: string | null;
  status: "REQUESTED" | "ASSIGNED" | "IN_TRANSIT" | "DELIVERED";
}
