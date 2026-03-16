"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, children, className }: TabsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex border-b border-border-subtle overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-3 border-b-2 transition-colors whitespace-nowrap text-sm font-medium",
              "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2",
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-foreground-muted hover:text-foreground hover:border-border-subtle"
            )}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div className={className}>{children}</div>;
}
