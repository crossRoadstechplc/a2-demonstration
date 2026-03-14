import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DataTableWrapperProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function DataTableWrapper({
  title,
  subtitle,
  children,
  className,
}: DataTableWrapperProps) {
  return (
    <div className={cn("panel overflow-hidden", className)}>
      {title ? (
        <div className="border-b border-border-subtle px-4 py-3">
          <p className="type-label">{title}</p>
          {subtitle ? <p className="mt-1 text-xs text-foreground-muted">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
