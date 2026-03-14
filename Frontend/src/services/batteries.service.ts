import { api } from "./api";
import type { Battery } from "@/types/battery";

export const batteriesService = {
  list: async () => {
    const { data } = await api.get<{ batteries: Battery[] }>("/batteries");
    return data.batteries;
  },
  getById: async (id: number) => {
    const { data } = await api.get<{ battery: Battery }>(`/batteries/${id}`);
    return data.battery;
  },
  getHistory: async (id: number) => {
    const { data } = await api.get(`/batteries/${id}/history`);
    return data;
  },
  create: async (payload: Omit<Battery, "id">) => {
    const { data } = await api.post<{ battery: Battery }>("/batteries", payload);
    return data.battery;
  },
  updateSoc: async (id: number, payload: { soc: number }) => {
    const { data } = await api.patch<{ battery: Battery }>(`/batteries/${id}/soc`, payload);
    return data.battery;
  },
  assignTruck: async (id: number, payload: { truckId: number }) => {
    const { data } = await api.patch<{ battery: Battery }>(
      `/batteries/${id}/assign-truck`,
      payload
    );
    return data.battery;
  },
  assignStation: async (id: number, payload: { stationId: number }) => {
    const { data } = await api.patch<{ battery: Battery }>(
      `/batteries/${id}/assign-station`,
      payload
    );
    return data.battery;
  },
};
