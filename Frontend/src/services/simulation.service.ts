import { api } from "./api";

export const simulationService = {
  start: async () => {
    const { data } = await api.post("/simulation/start", {});
    return data;
  },
  stop: async () => {
    const { data } = await api.post("/simulation/stop", {});
    return data;
  },
};
