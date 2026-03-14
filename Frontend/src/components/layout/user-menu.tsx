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
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-background-elevated px-3 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-xs font-semibold text-accent">
        {initials}
      </div>
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium text-foreground">
          {user?.name ?? "Operator"}
        </p>
        <p className="truncate text-xs text-foreground-muted">
          {role ? ROLE_DISPLAY_NAME[role] : "Unassigned"}
        </p>
      </div>
      <button
        type="button"
        className="rounded-lg border border-border-subtle px-2 py-1 text-xs text-foreground-muted transition hover:border-accent hover:text-accent"
        onClick={logout}
      >
        Logout
      </button>
    </div>
  );
}
