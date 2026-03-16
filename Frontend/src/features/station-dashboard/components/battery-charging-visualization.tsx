"use client";

import { memo, useMemo, useEffect, useState } from "react";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Battery } from "@/types/battery";

interface BatteryChargingVisualizationProps {
  batteries: Battery[];
}

function batteryVariant(status: Battery["status"]) {
  if (status === "READY") return "success";
  if (status === "CHARGING") return "warning";
  if (status === "IN_TRUCK") return "info";
  return "neutral";
}

function batteryColor(status: Battery["status"]) {
  if (status === "READY") return "bg-green-500";
  if (status === "CHARGING") return "bg-amber-500";
  if (status === "IN_TRUCK") return "bg-cyan-500";
  return "bg-gray-500";
}

export const BatteryChargingVisualization = memo(function BatteryChargingVisualization({
  batteries,
}: BatteryChargingVisualizationProps) {
  // Track animated SOC values for smooth transitions
  const [animatedSoc, setAnimatedSoc] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    // Update animated SOC values smoothly
    setAnimatedSoc((prev) => {
      const newAnimatedSoc = new Map<number, number>();
      batteries.forEach((battery) => {
        const currentAnimated = prev.get(battery.id) ?? battery.soc;
        // Smoothly animate towards target SOC
        const diff = battery.soc - currentAnimated;
        if (Math.abs(diff) > 0.5) {
          newAnimatedSoc.set(battery.id, currentAnimated + diff * 0.15);
        } else {
          newAnimatedSoc.set(battery.id, battery.soc);
        }
      });
      return newAnimatedSoc;
    });
  }, [batteries]);

  const sortedBatteries = useMemo(() => {
    return [...batteries].sort((a, b) => {
      // Sort by status: CHARGING first, then READY, then others
      const statusOrder = { CHARGING: 0, READY: 1, IN_TRUCK: 2, MAINTENANCE: 3 };
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 99;
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Then by SOC descending
      return b.soc - a.soc;
    });
  }, [batteries]);

  const statusCounts = useMemo(() => {
    return {
      READY: batteries.filter((b) => b.status === "READY").length,
      CHARGING: batteries.filter((b) => b.status === "CHARGING").length,
      IN_TRUCK: batteries.filter((b) => b.status === "IN_TRUCK").length,
      MAINTENANCE: batteries.filter((b) => b.status === "MAINTENANCE").length,
    };
  }, [batteries]);

  if (batteries.length === 0) {
    return (
      <div className="panel card-regular">
        <p className="type-label">Battery Charging Visualization</p>
        <EmptyPlaceholder title="No batteries at this station" />
      </div>
    );
  }

  return (
    <article className="panel card-regular">
      <div className="mb-3 flex items-center justify-between">
        <p className="type-label">Battery Charging Visualization</p>
        <div className="flex gap-2 text-xs text-foreground-muted">
          <span>Total: {batteries.length}</span>
          <span>•</span>
          <span className="text-green-500">Ready: {statusCounts.READY}</span>
          <span>•</span>
          <span className="text-amber-500">Charging: {statusCounts.CHARGING}</span>
          <span>•</span>
          <span className="text-cyan-500">In Truck: {statusCounts.IN_TRUCK}</span>
        </div>
      </div>

      <div className="max-h-[500px] space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border border-border-subtle bg-background-muted p-3">
        <div className="grid grid-cols-10 gap-2 sm:grid-cols-10 md:grid-cols-10 lg:grid-cols-10">
          {sortedBatteries.map((battery) => (
            <div
              key={battery.id}
              className="group relative flex flex-col items-center rounded-lg border border-border-subtle bg-background p-2 transition-all hover:border-amber-500 hover:shadow-md"
              title={`BAT-${battery.id} • ${battery.status} • ${battery.soc}% SOC`}
            >
              {/* Battery indicator */}
              <div className="relative h-12 w-full overflow-hidden">
                <div
                  className={`absolute inset-0 rounded ${batteryColor(battery.status)} opacity-20`}
                />
                {battery.status === "CHARGING" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded bg-amber-500 transition-all duration-500 ease-out"
                    style={{ 
                      height: `${animatedSoc.get(battery.id) ?? battery.soc}%`,
                      transition: "height 0.5s ease-out"
                    }}
                  />
                )}
                {battery.status === "READY" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded bg-green-500 transition-all duration-500 ease-out"
                    style={{ 
                      height: `${animatedSoc.get(battery.id) ?? battery.soc}%`,
                      transition: "height 0.5s ease-out"
                    }}
                  />
                )}
                {battery.status === "IN_TRUCK" && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded bg-cyan-500 transition-all duration-500 ease-out"
                    style={{ 
                      height: `${animatedSoc.get(battery.id) ?? battery.soc}%`,
                      transition: "height 0.5s ease-out"
                    }}
                  />
                )}
                {/* Charging animation - pulsing effect */}
                {battery.status === "CHARGING" && (
                  <div className="absolute inset-0 animate-pulse rounded bg-amber-500 opacity-30" />
                )}
              </div>

              {/* Battery ID */}
              <p className="mt-1 text-[10px] font-mono text-foreground-muted">
                {battery.id}
              </p>

              {/* SOC */}
              <p className="text-[9px] font-medium text-foreground">{battery.soc}%</p>

              {/* Status badge on hover */}
              <div className="absolute -right-1 -top-1 opacity-0 transition-opacity group-hover:opacity-100">
                <StatusBadge
                  label={battery.status}
                  variant={batteryVariant(battery.status)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>Ready ({statusCounts.READY})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-amber-500" />
          <span>Charging ({statusCounts.CHARGING})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-cyan-500" />
          <span>In Truck ({statusCounts.IN_TRUCK})</span>
        </div>
      </div>
    </article>
  );
});
