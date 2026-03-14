import { api } from "./api";
import type { A2DashboardSummary, FreightDashboardSummary } from "@/types/dashboard";
import type { LiveFeedEventGroup } from "@/types/live-feed";

export const dashboardService = {
  a2: async () => {
    const { data } = await api.get<A2DashboardSummary>("/dashboard/a2");
    return data;
  },
  station: async (id: number) => {
    const { data } = await api.get(`/dashboard/station/${id}`);
    return data;
  },
  fleet: async (id: number) => {
    const { data } = await api.get(`/dashboard/fleet/${id}`);
    return data;
  },
  driver: async (id: number) => {
    const { data } = await api.get(`/dashboard/driver/${id}`);
    return data;
  },
  eeu: async () => {
    const { data } = await api.get("/dashboard/eeu");
    return data;
  },
  freight: async (customerId: number) => {
    const { data } = await api.get<FreightDashboardSummary>(
      `/dashboard/freight/${customerId}`
    );
    return data;
  },
  liveFeed: async () => {
    const { data } = await api.get<LiveFeedEventGroup>("/dashboard/a2/live-feed");
    return data;
  },
};
