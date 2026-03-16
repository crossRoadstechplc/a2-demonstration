import { api } from "./api";
import type { Receipt } from "@/types/receipt";

export const PAYMENT_METHODS = ["CBE", "CBEbirr", "Telebirr", "Others"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const billingService = {
  receipts: async () => {
    const { data } = await api.get<{ receipts: Receipt[] }>("/billing/receipts");
    return data.receipts;
  },
  payReceipt: async (receiptId: number, paymentMethod: string) => {
    const { data } = await api.patch<{ receipt: Receipt | null }>(
      `/billing/receipts/${receiptId}/pay`,
      { paymentMethod }
    );
    return data.receipt;
  },
  summaryA2: async () => {
    const { data } = await api.get("/billing/summary/a2");
    return data;
  },
  summaryEeu: async (timeframe: "daily" | "monthly" | "yearly" = "daily") => {
    const { data } = await api.get(`/billing/summary/eeu?timeframe=${timeframe}`);
    return data;
  },
  summaryStations: async () => {
    const { data } = await api.get("/billing/summary/stations");
    return data;
  },
  summaryFleets: async () => {
    const { data } = await api.get("/billing/summary/fleets");
    return data;
  },
};
