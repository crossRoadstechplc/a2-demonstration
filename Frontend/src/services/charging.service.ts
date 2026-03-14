import { api } from "./api";

export const chargingService = {
  start: async (payload: { stationId: number; batteryId: number }) => {
    const { data } = await api.post<{ session: unknown }>("/charging/start", payload);
    return data.session;
  },
  complete: async (payload: { sessionId: number; endSoc: number }) => {
    const { data } = await api.post<{ session: unknown; battery: unknown }>(
      "/charging/complete",
      payload
    );
    return data;
  },
  listByStation: async (stationId: number) => {
    const { data } = await api.get<{ sessions: unknown[] }>(
      `/charging/station/${stationId}`
    );
    return data.sessions;
  },
};
