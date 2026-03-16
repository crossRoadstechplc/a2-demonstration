"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { SIDEBAR_SECTIONS } from "@/constants/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

import { SidebarSection } from "./sidebar-section";

export function Sidebar() {
  const pathname = usePathname();
  const { role, logout } = useAuth();
  const sidebarState = useUiStore((state) => state.sidebarState);
  const collapsed = sidebarState === "collapsed";
  const isDriverScreen = pathname.startsWith("/driver");

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!role) {
        return item.href === "/login";
      }
      if (isDriverScreen && role === "DRIVER") {
        return item.href === "/driver" || item.href === "/login";
      }
      return item.allowedRoles.includes(role);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "panel sticky top-0 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col gap-5 p-4 lg:flex",
        collapsed ? "w-[88px]" : "w-[280px]"
      )}
    >
      <div className="rounded-xl border border-border-subtle bg-background-muted p-3">
        <div className="flex flex-col items-center gap-2">
          <div className="shrink-0">
            <Image
              src="/logo.png"
              alt="A2 Access Africa E-Corridor Logo"
              width={collapsed ? 160 : 200}
              height={collapsed ? 160 : 200}
              className="h-auto w-auto"
              priority
            />
          </div>
          {!collapsed && (
            <p className="text-xs text-center text-foreground-muted leading-tight">
              A2 Network Platform Operations Command
            </p>
          )}
        </div>
      </div>

      <nav className="flex flex-col gap-4 overflow-y-auto pr-1 flex-1">
        {visibleSections.map((section) => {
          // Separate out logout item so we can render it as a button
          const regularItems = section.items.filter((item) => item.href !== "/login");
          const hasLogout = section.items.some((item) => item.href === "/login");

          return (
            <div key={section.title}>
              <SidebarSection
                title={section.title}
                items={regularItems}
                collapsed={collapsed}
              />
              {hasLogout && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={logout}
                    className={cn(
                      "flex w-full items-center rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition text-red-400/80 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    {collapsed ? (
                      <span className="font-mono text-xs">LO</span>
                    ) : (
                      "Logout"
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
