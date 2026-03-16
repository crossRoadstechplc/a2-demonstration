"use client";

import { usePathname } from "next/navigation";

import { ROLE_DISPLAY_NAME } from "@/constants/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useUiStore } from "@/store/ui-store";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { DemoControls } from "@/components/demo/demo-controls";
import { UserMenu } from "./user-menu";

const PAGE_LABEL_MAP: Record<string, string> = {
  "/a2": "A2 Network Command",
  "/station": "Station Operations",
  "/driver": "Driver Operations",
  "/fleet": "Fleet Operations",
  "/freight": "Freight Customer Portal",
  "/eeu": "EEU Grid Operations",
};

export function Topbar() {
  const pathname = usePathname();
  const themeMode = useUiStore((state) => state.themeMode);
  const setThemeMode = useUiStore((state) => state.setThemeMode);
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const lastLiveSyncAt = useUiStore((state) => state.lastLiveSyncAt);
  const { role } = useAuth();
  const pageLabel =
    PAGE_LABEL_MAP[pathname] ??
    (pathname === "/"
      ? "Overview"
      : pathname
          .slice(1)
          .split("/")
          .filter(Boolean)
          .join(" / "));

  return (
    <header className="panel mb-4 flex items-center justify-between gap-3 px-4 py-3 md:mb-5 md:px-5">
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <p className="type-label">A2 Network Live</p>
          <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">
            {pageLabel}
          </h1>
          <p className="mt-1 text-xs text-foreground-muted">
            {role ? ROLE_DISPLAY_NAME[role] : "Authentication required"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LiveRefreshIndicator
          isLive={liveUpdatesEnabled}
          isRefreshing={false}
          lastSyncAt={lastLiveSyncAt}
          compact
        />
        <button
          type="button"
          onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
          className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent"
        >
          {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <DemoControls />
        <UserMenu />
      </div>
    </header>
  );
}
