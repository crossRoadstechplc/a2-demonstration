import { api } from "./api";
import type { Driver } from "@/types/driver";

export const driversService = {
  list: async () => {
    const { data } = await api.get<{ drivers: Driver[] }>("/drivers");
    return data.drivers;
  },
  getById: async (id: number) => {
    const { data } = await api.get<{ driver: Driver }>(`/drivers/${id}`);
    return data.driver;
  },
  create: async (payload: {
    name: string;
    phone: string;
    fleetId: number;
    rating: number;
    status: string;
  }) => {
    const { data } = await api.post<{ driver: Driver }>("/drivers", payload);
    return data.driver;
  },
  rate: async (id: number, payload: { customerRating: number; deliveryFeedback: string }) => {
    const { data } = await api.post<{ driver: Driver }>(`/drivers/${id}/rate`, payload);
    return data.driver;
  },
  telemetry: async (
    id: number,
    payload: { speed: number; brakeForce: number; timestamp: string }
  ) => {
    const { data } = await api.post<{ driver: Driver }>(
      `/drivers/${id}/telemetry`,
      payload
    );
    return data.driver;
  },
  assignTruck: async (id: number, payload: { truckId: number }) => {
    const { data } = await api.post<{ driver: Driver }>(
      `/drivers/${id}/assign-truck`,
      payload
    );
    return data.driver;
  },
  arriveStation: async (
    id: number,
    payload: { stationId: number; truckId: number }
  ) => {
    const { data } = await api.post<{ arrival: unknown }>(
      `/drivers/${id}/arrive-station`,
      payload
    );
    return data.arrival;
  },
};
