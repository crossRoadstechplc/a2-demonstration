"use client";

import { useMemo } from "react";

import { ROLE_DISPLAY_NAME } from "@/constants/navigation";
import { useAuth } from "@/hooks/use-auth";

export function UserMenu() {
  const { user, role, logout } = useAuth();

  const initials = useMemo(() => {
    const value = user?.name ?? "A2";
    return value
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [user?.name]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-background-elevated px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent/15 text-sm font-bold text-accent">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {user?.name ?? "Operator"}
        </p>
        <p className="truncate text-xs text-foreground-muted">
          {role ? ROLE_DISPLAY_NAME[role] : "Unassigned"}
        </p>
      </div>
    </div>
  );
}
