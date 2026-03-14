"use client";

import { create } from "zustand";

import type { User } from "@/types/user";
import { authService } from "@/services/auth.service";

const TOKEN_STORAGE_KEY = "a2_auth_token";
const USER_STORAGE_KEY = "a2_auth_user";

interface AuthState {
  token: string | null;
  user: User | null;
  role: User["role"] | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (params: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
  setAuth: (params: { token: string; user: User }) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  role: null,
  isAuthenticated: false,
  isHydrated: false,
  login: async ({ email, password }) => {
    const payload = await authService.login({ email, password });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user));
    }

    set({
      token: payload.token,
      user: payload.user,
      role: payload.user.role,
      isAuthenticated: true,
    });
  },
  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }

    set({
      token: null,
      user: null,
      role: null,
      isAuthenticated: false,
    });
  },
  hydrate: () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }

    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    const userRaw = window.localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !userRaw) {
      set({ isHydrated: true });
      return;
    }

    try {
      const user = JSON.parse(userRaw) as User;
      set({
        token,
        user,
        role: user.role,
        isAuthenticated: true,
        isHydrated: true,
      });
    } catch {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      set({ isHydrated: true });
    }
  },
  setAuth: ({ token, user }) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }

    set({
      token,
      user,
      role: user.role,
      isAuthenticated: true,
      isHydrated: true,
    });
  },
}));
