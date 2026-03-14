"use client";

import type { AppRole } from "@/types/auth";
import { useAuthStore } from "@/store/auth-store";

export function useRole() {
  const role = useAuthStore((state) => state.role);

  function hasRole(...roles: AppRole[]): boolean {
    if (!role) {
      return false;
    }
    return roles.includes(role);
  }

  return { role, hasRole };
}
