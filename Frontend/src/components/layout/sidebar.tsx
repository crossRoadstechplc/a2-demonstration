"use client";

import { SIDEBAR_SECTIONS } from "@/constants/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

import { SidebarSection } from "./sidebar-section";

export function Sidebar() {
  const { role } = useAuth();
  const sidebarState = useUiStore((state) => state.sidebarState);
  const collapsed = sidebarState === "collapsed";

  const visibleSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      role ? item.allowedRoles.includes(role) : item.href === "/login"
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "panel sticky top-0 hidden h-[calc(100vh-1.5rem)] shrink-0 flex-col gap-5 p-4 lg:flex",
        collapsed ? "w-[88px]" : "w-[280px]"
      )}
    >
      <div className="rounded-xl border border-border-subtle bg-background-muted p-3">
        <p className={cn("type-label", collapsed && "text-center")}>A2 Network</p>
        <p className={cn("mt-1 text-base font-semibold", collapsed && "text-center text-sm")}>
          {collapsed ? "HQ" : "HQ Operations Command"}
        </p>
      </div>

      <nav className="space-y-4 overflow-y-auto pr-1">
        {visibleSections.map((section) => (
          <SidebarSection
            key={section.title}
            title={section.title}
            items={section.items}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
}
