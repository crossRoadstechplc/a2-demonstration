import { api } from "./api";
import type { Fleet } from "@/types/fleet";

export const fleetsService = {
  list: async () => {
    const { data } = await api.get<{ fleets: Fleet[] }>("/fleets");
    return data.fleets;
  },
  create: async (payload: Omit<Fleet, "id">) => {
    const { data } = await api.post<{ fleet: Fleet }>("/fleets", payload);
    return data.fleet;
  },
  assignDriver: async (fleetId: number, payload: { driverId: number; truckId: number }) => {
    const { data } = await api.post<{ status: string }>(
      `/fleets/${fleetId}/assign-driver`,
      payload
    );
    return data;
  },
};
