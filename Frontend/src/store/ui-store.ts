"use client";

import { create } from "zustand";

import type { SidebarState } from "@/types/ui";

interface UiStoreState {
  sidebarState: SidebarState;
  themeMode: "dark" | "light";
  activeOrganizationId: string | null;
  isMobileMenuOpen: boolean;
  liveUpdatesEnabled: boolean;
  lastLiveSyncAt: number;
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setThemeMode: (mode: "dark" | "light") => void;
  setActiveOrganizationId: (organizationId: string | null) => void;
  setLiveUpdatesEnabled: (enabled: boolean) => void;
  setLastLiveSyncAt: (timestamp: number) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  sidebarState: "expanded",
  themeMode: "light",
  activeOrganizationId: null,
  isMobileMenuOpen: false,
  liveUpdatesEnabled: true,
  lastLiveSyncAt: 0,
  toggleSidebar: () =>
    set((state) => ({
      sidebarState:
        state.sidebarState === "expanded" ? "collapsed" : "expanded",
    })),
  toggleMobileMenu: () =>
    set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  setThemeMode: (mode) =>
    set((state) => (state.themeMode === mode ? state : { themeMode: mode })),
  setActiveOrganizationId: (organizationId) =>
    set({ activeOrganizationId: organizationId }),
  setLiveUpdatesEnabled: (enabled) => set({ liveUpdatesEnabled: enabled }),
  setLastLiveSyncAt: (timestamp) => set({ lastLiveSyncAt: timestamp }),
}));
