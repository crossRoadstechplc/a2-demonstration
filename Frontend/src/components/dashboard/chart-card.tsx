import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
  className,
}: ChartCardProps) {
  return (
    <article className={cn("panel card-regular", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="type-label">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4 h-[220px] rounded-xl border border-border-subtle bg-background-muted p-3">
        {children ?? (
          <div className="flex h-full items-end gap-2">
            {Array.from({ length: 14 }).map((_, index) => (
              <div
                key={index}
                className="w-full rounded-sm bg-accent/70"
                style={{ height: `${20 + ((index * 11) % 75)}%` }}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
