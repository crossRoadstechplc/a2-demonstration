"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/constants/navigation";
import { cn } from "@/lib/utils";

interface SidebarSectionProps {
  title: string;
  items: NavItem[];
  collapsed?: boolean;
}

export function SidebarSection({
  title,
  items,
  collapsed = false,
}: SidebarSectionProps) {
  const pathname = usePathname();

  return (
    <section className="space-y-2">
      {!collapsed ? <p className="type-label px-2">{title}</p> : null}
      <div className="space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-xl border px-3 py-2 text-sm transition",
                isActive
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-transparent text-foreground-muted hover:border-border-subtle hover:bg-background-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              {collapsed ? (
                <span className="font-mono text-xs">{item.label.slice(0, 2).toUpperCase()}</span>
              ) : (
                item.label
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
