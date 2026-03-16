"use client";

/**
 * Simple horizontal bar chart for dashboard KPIs.
 * Uses CSS for bars; no chart library dependency.
 */

export interface BarItem {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  items: BarItem[];
  /** Optional max for scale; defaults to max value in items */
  max?: number;
  valueLabel?: (value: number) => string;
  className?: string;
}

export function SimpleBarChart({
  items,
  max,
  valueLabel = (v) => String(v),
  className = "",
}: SimpleBarChartProps) {
  const maxVal = max ?? (items.length ? Math.max(...items.map((i) => i.value), 1) : 1);
  const scale = maxVal <= 0 ? 0 : 100 / maxVal;

  if (items.length === 0) {
    return (
      <div className={`flex h-full min-h-[120px] items-center justify-center text-sm text-foreground-muted ${className}`}>
        No data
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col gap-1.5 overflow-hidden ${className}`}>
      {items.slice(0, 12).map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-xs text-foreground-muted" title={item.label}>
            {item.label}
          </span>
          <div className="min-h-5 flex-1 rounded bg-background-muted">
            <div
              className="h-5 min-w-[4px] rounded bg-accent/80 transition-[width]"
              style={{ width: `${Math.min(100, item.value * scale)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs text-foreground">
            {valueLabel(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
