"use client";

import { StatusBadge } from "@/components/ui/status-badge";

interface LiveRefreshIndicatorProps {
  isLive: boolean;
  isRefreshing: boolean;
  hasStaleData?: boolean;
  lastSyncAt?: number;
  compact?: boolean;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return "never";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveRefreshIndicator({
  isLive,
  isRefreshing,
  hasStaleData = false,
  lastSyncAt,
  compact = false,
}: LiveRefreshIndicatorProps) {
  const variant = hasStaleData ? "warning" : isLive ? "success" : "neutral";
  const label = isRefreshing
    ? "Refreshing"
    : hasStaleData
      ? "Stale"
      : isLive
        ? "Live"
        : "Paused";

  if (compact) {
    return <StatusBadge label={label} variant={variant} />;
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
      <StatusBadge label={label} variant={variant} />
      <span className="text-xs text-foreground-muted">Last sync {formatTime(lastSyncAt)}</span>
    </div>
  );
}
