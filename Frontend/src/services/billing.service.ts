import { api } from "./api";
import type { Receipt } from "@/types/receipt";

export const billingService = {
  receipts: async () => {
    const { data } = await api.get<{ receipts: Receipt[] }>("/billing/receipts");
    return data.receipts;
  },
  summaryA2: async () => {
    const { data } = await api.get("/billing/summary/a2");
    return data;
  },
  summaryEeu: async () => {
    const { data } = await api.get("/billing/summary/eeu");
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
