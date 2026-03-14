import { api } from "./api";
import type { SwapTransaction } from "@/types/swap";

export const swapsService = {
  list: async () => {
    const { data } = await api.get<{ swaps: SwapTransaction[] }>("/swaps");
    return data.swaps;
  },
  create: async (payload: {
    truckId: number;
    stationId: number;
    incomingBatteryId: number;
    outgoingBatteryId: number;
    arrivalSoc: number;
  }) => {
    const { data } = await api.post<{ swap: SwapTransaction }>("/swaps", payload);
    return data.swap;
  },
};
