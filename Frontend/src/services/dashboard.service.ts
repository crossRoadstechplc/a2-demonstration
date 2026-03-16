import { api } from "./api";
import type {
  A2ChartsData,
  A2DashboardSummary,
  FleetEnergyByTruckData,
  FreightDashboardSummary,
} from "@/types/dashboard";
import type { LiveFeedEventGroup } from "@/types/live-feed";

export const dashboardService = {
  a2: async () => {
    const { data } = await api.get<A2DashboardSummary>("/dashboard/a2");
    return data;
  },
  a2Charts: async () => {
    const { data } = await api.get<A2ChartsData>("/dashboard/a2/charts");
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
  fleetEnergyByTruck: async (fleetId: number) => {
    const { data } = await api.get<FleetEnergyByTruckData>(
      `/dashboard/fleet/${fleetId}/energy-by-truck`
    );
    return data;
  },
  /** Export fleet report as CSV; returns blob and suggested filename. */
  fleetExport: async (fleetId: number): Promise<{ blob: Blob; filename: string }> => {
    const response = await api.get<Blob>(`/dashboard/fleet/${fleetId}/export?format=csv`, {
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const disposition = response.headers["content-disposition"];
    let filename = `fleet-${fleetId}-report.csv`;
    if (typeof disposition === "string") {
      const match = /filename="?([^";\n]+)"?/.exec(disposition);
      if (match) filename = match[1].trim();
    }
    return { blob, filename };
  },
  driver: async (id: number) => {
    const { data } = await api.get(`/dashboard/driver/${id}`);
    return data;
  },
  eeu: async (timeframe: "daily" | "monthly" | "yearly" = "daily") => {
    const { data } = await api.get(`/dashboard/eeu?timeframe=${timeframe}`);
    return data;
  },
  freight: async (customerId: number, timeframe: "daily" | "monthly" | "yearly" = "daily") => {
    const { data } = await api.get<FreightDashboardSummary>(
      `/dashboard/freight/${customerId}?timeframe=${timeframe}`
    );
    return data;
  },
  liveFeed: async () => {
    const { data } = await api.get<LiveFeedEventGroup>("/dashboard/a2/live-feed");
    return data;
  },
};
