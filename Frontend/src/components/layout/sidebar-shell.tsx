"use client";

import Image from "next/image";
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
        <div className={cn(
          "flex items-center gap-3",
          sidebarState === "collapsed" && "justify-center"
        )}>
          <Image
            src="/logo.png"
            alt="A2 Access Africa E-Corridor Logo"
            width={sidebarState === "expanded" ? 48 : 40}
            height={sidebarState === "expanded" ? 48 : 40}
            className="h-auto w-auto shrink-0"
            priority
          />
          {sidebarState === "expanded" && (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-foreground-muted">
                A2 E-Corridor
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                Operations
              </p>
            </div>
          )}
        </div>
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
