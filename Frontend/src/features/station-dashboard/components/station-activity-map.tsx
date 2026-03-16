"use client";

import { memo, useMemo } from "react";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Battery } from "@/types/battery";
import type { Truck } from "@/types/truck";
import type { SwapTransaction } from "@/types/swap";

interface ChargerStatus {
  chargerId: string;
  status: string;
  outputKw: number;
  batteryId: number | null;
  energyAddedKwh: number;
}

interface StationActivityMapProps {
  trucksAtStation: Truck[];
  batteries: Battery[];
  chargerStatus?: ChargerStatus[];
  swaps?: SwapTransaction[];
  roomTemperature?: number;
}

export const StationActivityMap = memo(function StationActivityMap({
  trucksAtStation,
  batteries,
  chargerStatus = [],
  swaps = [],
  roomTemperature = 28,
}: StationActivityMapProps) {
  const chargingBatteries = useMemo(() => {
    return batteries.filter((b) => b.status === "CHARGING");
  }, [batteries]);

  const readyBatteries = useMemo(() => {
    return batteries.filter((b) => b.status === "READY");
  }, [batteries]);

  const totalPowerInput = useMemo(() => {
    // Sum of all active chargers (assuming 50kW per charger)
    return chargerStatus.filter((c) => c.status === "ACTIVE").length * 50;
  }, [chargerStatus]);

  const totalPowerOutput = useMemo(() => {
    // Energy being added per hour (rough estimate)
    return chargingBatteries.length * 5; // ~5kW per battery charging
  }, [chargingBatteries.length]);

  const swapStationCount = useMemo(() => {
    return Math.min(4, Math.max(2, Math.ceil(swaps.length / 5) + 1));
  }, [swaps.length]);

  const recentSwaps = useMemo(() => {
    return swaps.filter((s) => {
      const swapTime = new Date(s.timestamp);
      const now = new Date();
      return (now.getTime() - swapTime.getTime()) < 5 * 60 * 1000; // Last 5 minutes
    });
  }, [swaps]);

  return (
    <article className="panel card-regular">
      <div className="mb-3 flex items-center justify-between">
        <p className="type-label">Station Activity Map</p>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-foreground-muted">Room Temperature</p>
            <p className="text-lg font-bold text-foreground">{roomTemperature}°C</p>
          </div>
        </div>
      </div>

      <div className="relative h-[500px] w-full overflow-hidden rounded-xl border border-border-subtle bg-background-muted">
        <svg
          viewBox="0 0 800 500"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background grid */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="800" height="500" fill="url(#grid)" />

          {/* Charging bays area (left side) */}
          <g>
            <rect
              x="20"
              y="20"
              width="400"
              height="460"
              fill="rgba(0,0,0,0.2)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              rx="4"
            />
            <text
              x="220"
              y="45"
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="14"
              fontWeight="bold"
            >
              Charging Bays (100 slots)
            </text>

            {/* Battery slots grid - show actual batteries */}
            {batteries.slice(0, 100).map((battery, index) => {
              const row = Math.floor(index / 10);
              const col = index % 10;
              const x = 40 + col * 36;
              const y = 60 + row * 36;
              const isCharging = battery.status === "CHARGING";
              const isReady = battery.status === "READY";

              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width="32"
                    height="32"
                    fill={
                      isCharging
                        ? "rgba(245,166,35,0.3)"
                        : isReady
                          ? "rgba(0,230,118,0.2)"
                          : "rgba(255,255,255,0.05)"
                    }
                    stroke={
                      isCharging
                        ? "#f5a623"
                        : isReady
                          ? "#00e676"
                          : "rgba(255,255,255,0.1)"
                    }
                    strokeWidth={isCharging || isReady ? 2 : 1}
                    rx="2"
                  />
                  {isCharging && (
                    <circle
                      cx={x + 16}
                      cy={y + 16}
                      r="4"
                      fill="#f5a623"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0.8"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  {battery && (
                    <text
                      x={x + 16}
                      y={y + 22}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.6)"
                      fontSize="8"
                    >
                      {battery.soc}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Parking bays area (right side) */}
          <g>
            <rect
              x="440"
              y="20"
              width="340"
              height="220"
              fill="rgba(0,0,0,0.2)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              rx="4"
            />
            <text
              x="610"
              y="45"
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="14"
              fontWeight="bold"
            >
              Parking Bays
            </text>

            {/* Truck parking slots */}
            {trucksAtStation.slice(0, 8).map((truck, index) => {
              const col = index % 4;
              const row = Math.floor(index / 4);
              const x = 460 + col * 80;
              const y = 60 + row * 70;

              return (
                <g key={truck.id}>
                  <rect
                    x={x}
                    y={y}
                    width="70"
                    height="60"
                    fill="rgba(0,212,255,0.1)"
                    stroke="#00d4ff"
                    strokeWidth="2"
                    rx="4"
                  />
                  <text
                    x={x + 35}
                    y={y + 20}
                    textAnchor="middle"
                    fill="#00d4ff"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {truck.plateNumber || `TRK-${truck.id}`}
                  </text>
                  <text
                    x={x + 35}
                    y={y + 35}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize="9"
                  >
                    SOC: {truck.currentSoc}%
                  </text>
                  <text
                    x={x + 35}
                    y={y + 48}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="8"
                  >
                    {truck.status}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Swap Stations */}
          <g>
            <rect
              x="440"
              y="260"
              width="340"
              height="120"
              fill="rgba(0,0,0,0.2)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              rx="4"
            />
            <text
              x="610"
              y="285"
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="14"
              fontWeight="bold"
            >
              Swap Stations
            </text>

            {/* Swap bays (2-4 swap stations) */}
            {Array.from({ length: swapStationCount }).map((_, index) => {
              const x = 460 + (index % 2) * 160;
              const y = 300 + Math.floor(index / 2) * 50;
              const recentSwap = recentSwaps[index];
              const isActive = !!recentSwap;

              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width="150"
                    height="40"
                    fill={isActive ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)"}
                    stroke={isActive ? "#00e676" : "rgba(255,255,255,0.1)"}
                    strokeWidth={isActive ? 2 : 1}
                    rx="4"
                  />
                  <text
                    x={x + 75}
                    y={y + 20}
                    textAnchor="middle"
                    fill={isActive ? "#00e676" : "rgba(255,255,255,0.5)"}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    {isActive ? "SWAPPING" : "READY"}
                  </text>
                  {isActive && (
                    <text
                      x={x + 75}
                      y={y + 32}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.7)"
                      fontSize="9"
                    >
                      Truck {recentSwap.truckId}
                    </text>
                  )}
                  {isActive && (
                    <circle
                      cx={x + 10}
                      cy={y + 20}
                      r="4"
                      fill="#00e676"
                    >
                      <animate
                        attributeName="opacity"
                        values="1;0.3;1"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                </g>
              );
            })}
          </g>

          {/* Power flow indicators */}
          <g>
            <rect
              x="440"
              y="390"
              width="340"
              height="90"
              fill="rgba(0,0,0,0.2)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              rx="4"
            />
            <text
              x="610"
              y="415"
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="14"
              fontWeight="bold"
            >
              Power Flow
            </text>

            {/* Power input */}
            <g>
              <text
                x="460"
                y="440"
                fill="rgba(255,255,255,0.6)"
                fontSize="12"
              >
                Power Input (Grid)
              </text>
              <rect
                x="460"
                y="450"
                width="150"
                height="25"
                fill="rgba(0,230,118,0.2)"
                stroke="#00e676"
                strokeWidth="2"
                rx="4"
              />
              <text
                x="535"
                y="465"
                textAnchor="middle"
                fill="#00e676"
                fontSize="13"
                fontWeight="bold"
              >
                {totalPowerInput} kW
              </text>
            </g>

            {/* Power output (charging) */}
            <g>
              <text
                x="620"
                y="440"
                fill="rgba(255,255,255,0.6)"
                fontSize="12"
              >
                Power Output
              </text>
              <rect
                x="620"
                y="450"
                width="150"
                height="25"
                fill="rgba(245,166,35,0.2)"
                stroke="#f5a623"
                strokeWidth="2"
                rx="4"
              />
              <text
                x="695"
                y="465"
                textAnchor="middle"
                fill="#f5a623"
                fontSize="13"
                fontWeight="bold"
              >
                {totalPowerOutput} kW
              </text>
            </g>
          </g>

          {/* Arrow markers */}
          <defs>
            <marker
              id="arrow-green"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#00e676" />
            </marker>
            <marker
              id="arrow-amber"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#f5a623" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Stats summary */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs text-foreground-muted">Active Chargers</p>
          <p className="text-lg font-bold text-foreground">
            {chargerStatus.filter((c) => c.status === "ACTIVE").length}
          </p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs text-foreground-muted">Batteries Charging</p>
          <p className="text-lg font-bold text-amber-500">{chargingBatteries.length}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs text-foreground-muted">Power Input</p>
          <p className="text-lg font-bold text-green-500">{totalPowerInput} kW</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs text-foreground-muted">Trucks at Station</p>
          <p className="text-lg font-bold text-cyan-500">{trucksAtStation.length}</p>
        </div>
      </div>
    </article>
  );
});
