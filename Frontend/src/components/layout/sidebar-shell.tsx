"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/constants/roles";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

export function SidebarShell() {
  const pathname = usePathname();
  const sidebarState = useUiStore((state) => state.sidebarState);

  return (
    <aside
      className={cn(
        "panel sticky top-0 hidden h-screen shrink-0 flex-col p-4 lg:flex",
        sidebarState === "expanded" ? "w-64" : "w-20"
      )}
    >
      <div className="mb-6 px-2">
        <p
          className={cn(
            "text-xs uppercase tracking-[0.2em] text-foreground-muted",
            sidebarState === "collapsed" && "hidden"
          )}
        >
          A2 E-Corridor
        </p>
        <p className="mt-1 text-lg font-semibold text-foreground">
          {sidebarState === "expanded" ? "Operations" : "A2"}
        </p>
      </div>

      <nav className="space-y-1">
        {DASHBOARD_ROUTES.map((route) => {
          const isActive = pathname.startsWith(route.href);
          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center rounded-xl border px-3 py-2 text-sm transition",
                isActive
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-transparent text-foreground-muted hover:border-border-subtle hover:bg-background-muted hover:text-foreground"
              )}
            >
              <span className={cn(sidebarState === "collapsed" && "sr-only")}>
                {route.label}
              </span>
              {sidebarState === "collapsed" && (
                <span aria-hidden className="mx-auto h-2 w-2 rounded-full bg-current" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
