"use client";

import { useShallow } from "zustand/react/shallow";

import { useAuthStore } from "@/store/auth-store";

export function useAuth() {
  return useAuthStore(
    useShallow((state) => ({
      token: state.token,
      user: state.user,
      role: state.role,
      isAuthenticated: state.isAuthenticated,
      isHydrated: state.isHydrated,
      login: state.login,
      logout: state.logout,
      hydrate: state.hydrate,
      setAuth: state.setAuth,
    }))
  );
}
