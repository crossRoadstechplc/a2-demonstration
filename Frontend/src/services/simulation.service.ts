import { api } from "./api";

export const simulationService = {
  status: async () => {
    const { data } = await api.get<{ running: boolean }>("/simulation/status");
    return data;
  },
  start: async () => {
    const { data } = await api.post("/simulation/start", {});
    return data;
  },
  stop: async () => {
    const { data } = await api.post("/simulation/stop", {});
    return data;
  },
  /** Reset simulation data and run bootstrap to get fresh batteries, swaps, revenue */
  reset: async () => {
    const { data } = await api.post<{ status: string; message: string }>(
      "/simulation/reset",
      {}
    );
    return data;
  },
};
