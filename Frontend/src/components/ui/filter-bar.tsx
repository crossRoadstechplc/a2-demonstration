import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "panel card-tight flex flex-wrap items-center gap-2 md:gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FilterBarGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
      {children}
    </div>
  );
}
