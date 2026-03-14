export interface Receipt {
  id: number;
  swapId: number;
  energyKwh: number;
  energyCharge: number;
  serviceCharge: number;
  vat: number;
  total: number;
  eeuShare: number;
  a2Share: number;
  timestamp: string;
}
