import { ApiError, api } from "./api";
import type { Station, StationIncident, ChargerFault } from "@/types/station";

export const stationsService = {
  list: async () => {
    const { data } = await api.get<{ stations: Station[] }>("/stations");
    return data.stations;
  },
  create: async (payload: Omit<Station, "id">) => {
    const { data } = await api.post<{ station: Station }>("/stations", payload);
    return data.station;
  },
  updateConfig: async (stationId: number, payload: Record<string, unknown>) => {
    const { data } = await api.patch<{ stationConfig: unknown }>(
      `/stations/${stationId}/config`,
      payload
    );
    return data.stationConfig;
  },
  listIncidents: async (stationId: number) => {
    try {
      const { data } = await api.get<{ incidents: StationIncident[] }>(
        `/stations/${stationId}/incidents`
      );
      return data.incidents;
    } catch (error) {
      // Demo-friendly fallback: if role scoping blocks this station or user is unauthorized, keep dashboard usable.
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
        return [];
      }
      throw error;
    }
  },
  createIncident: async (stationId: number, payload: Omit<StationIncident, "id" | "stationId" | "reportedAt">) => {
    const { data } = await api.post<{ incident: StationIncident }>(
      `/stations/${stationId}/incidents`,
      payload
    );
    return data.incident;
  },
  listChargerFaults: async (stationId: number) => {
    try {
      const { data } = await api.get<{ chargerFaults: ChargerFault[] }>(
        `/stations/${stationId}/charger-faults`
      );
      return data.chargerFaults;
    } catch (error) {
      // Demo-friendly fallback: if role scoping blocks this station or user is unauthorized, keep dashboard usable.
      if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
        return [];
      }
      throw error;
    }
  },
  createChargerFault: async (
    stationId: number,
    payload: Omit<ChargerFault, "id" | "stationId" | "reportedAt" | "resolvedAt">
  ) => {
    const { data } = await api.post<{ chargerFault: ChargerFault }>(
      `/stations/${stationId}/charger-faults`,
      payload
    );
    return data.chargerFault;
  },
};
