import { api } from "./api";
import type { Truck } from "@/types/truck";

export const trucksService = {
  list: async () => {
    const { data } = await api.get<{ trucks: Truck[] }>("/trucks");
    return data.trucks;
  },
  getById: async (id: number) => {
    const { data } = await api.get<{ truck: Truck }>(`/trucks/${id}`);
    return data.truck;
  },
  create: async (payload: Omit<Truck, "id">) => {
    const { data } = await api.post<{ truck: Truck }>("/trucks", payload);
    return data.truck;
  },
  updateTemperature: async (
    id: number,
    payload: { temperatureCurrent?: number; temperatureTarget?: number }
  ) => {
    const { data } = await api.patch<{ truck: Truck }>(
      `/trucks/${id}/temperature`,
      payload
    );
    return data.truck;
  },
  updateLocation: async (
    id: number,
    payload: { lat: number; lng: number; currentStationId?: number }
  ) => {
    const { data } = await api.patch<{ truck: Truck }>(`/trucks/${id}/location`, payload);
    return data.truck;
  },
  updateStatus: async (id: number, payload: { status: string }) => {
    const { data } = await api.patch<{ truck: Truck }>(`/trucks/${id}/status`, payload);
    return data.truck;
  },
  updateAvailability: async (id: number, payload: { availability: string }) => {
    const { data } = await api.patch<{ truck: Truck }>(
      `/trucks/${id}/availability`,
      payload
    );
    return data.truck;
  },
  refrigerated: async () => {
    const { data } = await api.get<{ trucks: Truck[] }>("/trucks/refrigerated");
    return data.trucks;
  },
};
