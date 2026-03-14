"use client";

import { create } from "zustand";

interface DateRange {
  from: string | null;
  to: string | null;
}

interface DashboardFilterState {
  stationId: number | null;
  fleetId: number | null;
  driverId: number | null;
  dateRange: DateRange;
  setStationId: (stationId: number | null) => void;
  setFleetId: (fleetId: number | null) => void;
  setDriverId: (driverId: number | null) => void;
  setDateRange: (range: DateRange) => void;
  resetFilters: () => void;
}

const initialDateRange: DateRange = { from: null, to: null };

export const useDashboardFilterStore = create<DashboardFilterState>((set) => ({
  stationId: null,
  fleetId: null,
  driverId: null,
  dateRange: initialDateRange,
  setStationId: (stationId) => set({ stationId }),
  setFleetId: (fleetId) => set({ fleetId }),
  setDriverId: (driverId) => set({ driverId }),
  setDateRange: (dateRange) => set({ dateRange }),
  resetFilters: () =>
    set({
      stationId: null,
      fleetId: null,
      driverId: null,
      dateRange: initialDateRange,
    }),
}));
