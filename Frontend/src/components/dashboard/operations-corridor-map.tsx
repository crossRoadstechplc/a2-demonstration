"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

import type { Battery } from "@/types/battery";
import type { Station } from "@/types/station";
import type { Truck } from "@/types/truck";

import { cn } from "@/lib/utils";

const corridorStations = [
  {
    code: "STN-001",
    name: "Addis Ababa (Main Hub)",
    short: "Addis Ababa",
    x: 80,
    y: 210,
    lat: 8.9806,
    lng: 38.7578,
  },
  { code: "STN-002", name: "Adama", short: "Adama", x: 200, y: 192, lat: 8.54, lng: 39.27 },
  { code: "STN-003", name: "Awash", short: "Awash", x: 320, y: 206, lat: 8.98, lng: 40.17 },
  { code: "STN-004", name: "Mieso", short: "Mieso", x: 440, y: 224, lat: 9.24, lng: 40.75 },
  {
    code: "STN-005",
    name: "Dire Dawa",
    short: "Dire Dawa",
    x: 580,
    y: 200,
    lat: 9.6,
    lng: 41.86,
  },
  {
    code: "STN-006",
    name: "Semera / Mille area",
    short: "Semera/Mille",
    x: 720,
    y: 176,
    lat: 11.79,
    lng: 41.01,
  },
  {
    code: "STN-007",
    name: "Djibouti Port Gateway",
    short: "Djibouti Port",
    x: 840,
    y: 186,
    lat: 11.58,
    lng: 43.15,
  },
] as const;

interface OperationsCorridorMapProps {
  stations?: Station[];
  trucks?: Truck[];
  batteries?: Battery[];
  highlightedStationId?: number | null;
  className?: string;
  title?: string;
}

const LINE_Y = 210;
const START_X = 70;
const END_X = 850;
/** Eastbound trucks travel slightly above the centerline; westbound slightly below */
const EASTBOUND_Y = LINE_Y - 5;
const WESTBOUND_Y = LINE_Y + 5;
const STATION_COLORS = ["#22c55e", "#06b6d4", "#f59e0b", "#a855f7", "#ef4444", "#14b8a6", "#eab308"];

function stationColorByIndex(index: number, highlighted: boolean): string {
  if (highlighted) return "#f59e0b";
  return STATION_COLORS[index % STATION_COLORS.length] ?? "#22c55e";
}

function mapLngToX(lng: number): number {
  const minLng = 38.7578;
  const maxLng = 43.15;
  const t = (lng - minLng) / (maxLng - minLng);
  const clamped = Math.max(0, Math.min(1, t));
  return START_X + (END_X - START_X) * clamped;
}

export function OperationsCorridorMap({
  stations,
  trucks,
  batteries,
  highlightedStationId = null,
  className,
  title = "CORRIDOR A2 OPERATIONS MAP",
}: OperationsCorridorMapProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const truckRefs = useRef<Record<number, SVGGElement | null>>({});
  const truckTweens = useRef<Record<number, gsap.core.Tween>>({});
  const [hoverCard, setHoverCard] = useState<{
    x: number;
    y: number;
    title: string;
    lines: string[];
  } | null>(null);
  const stationByName = new Map((stations ?? []).map((station) => [station.name, station]));
  const mappedStationNodes = useMemo(() => {
    return corridorStations.map((node) => {
      const mappedStation = (stations ?? []).find((station) => station.name === node.name);
      return {
        ...node,
        mappedStation,
      };
    });
  }, [stations]);
  const hasKnownStations = (stations ?? []).length > 0;
  const truckNodes = useMemo(() => {
    // Only show trucks that are truly on the road
    const onRoadTrucks = (trucks ?? [])
      .filter((truck) => truck.status === "IN_TRANSIT")
      .slice(0, 30);

    return onRoadTrucks.map((truck) => {
      // Determine direction: even IDs go east (Addis → Djibouti), odd go west
      const directionEast = truck.id % 2 === 0;

      // Start position: use GPS longitude if available, else spread evenly
      const sourceX =
        truck.locationLng !== null && truck.locationLng !== undefined
          ? mapLngToX(truck.locationLng)
          : START_X + ((truck.id * 41) % (END_X - START_X - 40));
      const x = Math.max(START_X + 6, Math.min(END_X - 6, sourceX));

      // Eastbound on upper lane, westbound on lower lane
      const y = directionEast ? EASTBOUND_Y : WESTBOUND_Y;

      const destinationNode = directionEast
        ? corridorStations.find((node) => node.x > x + 2) ?? corridorStations[corridorStations.length - 1]
        : [...corridorStations].reverse().find((node) => node.x < x - 2) ?? corridorStations[0];

      return {
        id: truck.id,
        plateNumber: truck.plateNumber,
        x,
        y,
        directionEast,
        destinationLabel: destinationNode.short,
      };
    });
  }, [trucks]);

  useEffect(() => {
    // Kill all existing tweens before re-attaching to (potentially new) DOM elements.
    // isExpanded is a dep so this re-runs whenever the fullscreen modal opens/closes,
    // ensuring GSAP targets the correct SVG elements each time.
    for (const tween of Object.values(truckTweens.current)) {
      tween.kill();
    }
    truckTweens.current = {};

    // Defer one frame so React has flushed the new DOM refs before GSAP reads them.
    const rafId = requestAnimationFrame(() => {
      for (const node of truckNodes) {
        const ref = truckRefs.current[node.id];
        if (!ref) continue;

        const corridorLength = END_X - START_X;
        const targetX = node.directionEast ? END_X - 8 : START_X + 8;
        const originX = node.directionEast ? START_X + 8 : END_X - 8;

        const distancePx = node.directionEast
          ? Math.max(1, targetX - node.x)
          : Math.max(1, node.x - originX === 0 ? corridorLength : node.x - targetX);

        const fullDuration = 75 + (node.id % 20);
        const firstLegDuration = (distancePx / corridorLength) * fullDuration;

        gsap.set(ref, { x: node.x, y: node.y });

        const animateOneLeg = (endX: number, dur: number) => {
          const tween = gsap.to(ref, {
            x: endX,
            duration: dur,
            ease: "none",
            onComplete: () => {
              gsap.set(ref, { x: originX });
              animateOneLeg(targetX, fullDuration);
            },
          });
          truckTweens.current[node.id] = tween;
        };

        animateOneLeg(targetX, firstLegDuration);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      for (const tween of Object.values(truckTweens.current)) {
        tween.kill();
      }
      truckTweens.current = {};
    };
  }, [truckNodes, isExpanded]);

  function renderMapCanvas(showTrucks = true) {
    return (
      <svg viewBox="0 0 900 420" className="h-full w-full">
        <defs>
          <linearGradient id="corridorBand" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.08" />
          </linearGradient>
        </defs>

        <rect width="900" height="420" fill="#080c10" />

        {/* Road band */}
        <path
          d={`M ${START_X},${LINE_Y} L ${END_X},${LINE_Y}`}
          stroke="url(#corridorBand)"
          strokeWidth="30"
          fill="none"
          opacity="0.5"
        />

        {/* Eastbound lane */}
        <path
          d={`M ${START_X},${EASTBOUND_Y} L ${END_X},${EASTBOUND_Y}`}
          stroke="#f59e0b"
          strokeWidth="1"
          fill="none"
          strokeDasharray="10 10"
          opacity="0.55"
        />
        {/* Centre divider */}
        <path
          d={`M ${START_X},${LINE_Y} L ${END_X},${LINE_Y}`}
          stroke="#f59e0b"
          strokeWidth="1.5"
          fill="none"
          opacity="0.7"
        />
        {/* Westbound lane */}
        <path
          d={`M ${START_X},${WESTBOUND_Y} L ${END_X},${WESTBOUND_Y}`}
          stroke="#06b6d4"
          strokeWidth="1"
          fill="none"
          strokeDasharray="10 10"
          opacity="0.55"
        />

        {mappedStationNodes.map((node, index) => {
          const knownStation = stationByName.get(node.name);
          const isHighlighted = Boolean(
            knownStation && highlightedStationId && knownStation.id === highlightedStationId
          );
          const color = stationColorByIndex(index, isHighlighted);
          const stationId = knownStation?.id ?? null;
          const readyCount =
            stationId === null
              ? 0
              : (batteries ?? []).filter(
                  (battery) => battery.stationId === stationId && battery.status === "READY"
                ).length;
          const chargingCount =
            stationId === null
              ? 0
              : (batteries ?? []).filter(
                  (battery) => battery.stationId === stationId && battery.status === "CHARGING"
                ).length;
          const trucksAtStation =
            stationId === null
              ? 0
              : (trucks ?? []).filter((truck) => truck.currentStationId === stationId).length;
          return (
            <g
              key={node.code}
              onMouseEnter={() =>
                setHoverCard({
                  x: node.x,
                  y: LINE_Y - 22,
                  title: `${node.code} · ${node.short}`,
                  lines: [
                    `Ready for swap: ${readyCount}`,
                    `Charging now: ${chargingCount}`,
                    `Trucks at station: ${trucksAtStation}`,
                  ],
                })
              }
              onMouseLeave={() => setHoverCard(null)}
            >
              <circle cx={node.x} cy={LINE_Y} r="13" fill="#0d1218" stroke={color} strokeWidth="1.8" />
              <circle cx={node.x} cy={LINE_Y} r="6.5" fill={color} opacity="0.9" />
              <text
                x={node.x}
                y={LINE_Y + 27}
                textAnchor="middle"
                fill="#e8f0f8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
              >
                {node.code}
              </text>
              <text
                x={node.x}
                y={LINE_Y + 38}
                textAnchor="middle"
                fill="#7a9bb5"
                fontSize="8"
                fontFamily="monospace"
              >
                {node.short}
              </text>
            </g>
          );
        })}

        {showTrucks && truckNodes.map((truck) => {
          const truckColor = truck.directionEast ? "#06b6d4" : "#a78bfa";
          return (
            <g
              key={`truck-${truck.id}`}
              ref={(element) => {
                truckRefs.current[truck.id] = element;
              }}
              onMouseEnter={() =>
                setHoverCard({
                  x: truck.x,
                  y: truck.y - 18,
                  title: `Truck ${truck.plateNumber}`,
                  lines: [
                    `Direction: ${truck.directionEast ? "Eastbound →" : "Westbound ←"}`,
                    `Destination: ${truck.destinationLabel}`,
                  ],
                })
              }
              onMouseLeave={() => setHoverCard(null)}
            >
              {/* Motion trail */}
              <line
                x1={truck.directionEast ? -9 : 9}
                y1={0}
                x2={0}
                y2={0}
                stroke={truckColor}
                strokeWidth="1.5"
                opacity="0.4"
              />
              {/* Truck body */}
              <circle cx={0} cy={0} r={4} fill={truckColor} opacity="0.92" />
              {/* Subtle pulse */}
              <circle cx={0} cy={0} r={7} fill="none" stroke={truckColor} opacity="0.3">
                <animate attributeName="r" values="5;9;5" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <title>{truck.plateNumber}</title>
            </g>
          );
        })}

        <text
          x="450"
          y="270"
          textAnchor="middle"
          fill="#f59e0b"
          fontSize="9"
          fontFamily="monospace"
          opacity="0.55"
          letterSpacing="3"
        >
          {title}
        </text>

        {/* Legend */}
        <circle cx={START_X + 10} cy={390} r={4} fill="#06b6d4" opacity="0.85" />
        <text x={START_X + 18} y={393} fill="#7a9bb5" fontSize="8" fontFamily="monospace">
          Eastbound →
        </text>
        <circle cx={START_X + 100} cy={390} r={4} fill="#a78bfa" opacity="0.85" />
        <text x={START_X + 108} y={393} fill="#7a9bb5" fontSize="8" fontFamily="monospace">
          Westbound ←
        </text>
      </svg>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_30%_30%,rgba(245,166,35,0.16),transparent_45%),linear-gradient(180deg,#0b121c,#090f18)] p-2",
        className
      )}
      role="button"
      tabIndex={0}
      onClick={() => setIsExpanded(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          setIsExpanded(true);
        }
      }}
    >
      {renderMapCanvas(!isExpanded)}
      <div className="pointer-events-none absolute left-4 top-4 rounded border border-border-subtle bg-background/70 px-2 py-1 text-[10px] uppercase tracking-widest text-foreground-muted">
        {hasKnownStations ? "Live stations" : "Template stations"}
      </div>
      <div className="pointer-events-none absolute right-4 top-4 rounded border border-border-subtle bg-background/70 px-2 py-1 text-[10px] uppercase tracking-widest text-foreground-muted">
        {truckNodes.length} trucks shown
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded border border-border-subtle bg-background/70 px-2 py-1 text-[10px] uppercase tracking-widest text-foreground-muted">
        Click to expand
      </div>
      {hoverCard ? (
        <div
          className="pointer-events-none absolute z-20 w-56 rounded border border-border-subtle bg-background-elevated px-3 py-2 text-xs text-foreground shadow-lg"
          style={{
            left: `${(hoverCard.x / 900) * 100}%`,
            top: `${(hoverCard.y / 420) * 100}%`,
            transform: "translate(-50%, -105%)",
          }}
        >
          <p className="font-semibold text-foreground">{hoverCard.title}</p>
          <div className="mt-1 space-y-0.5 text-foreground-muted">
            {hoverCard.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      {isExpanded ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded(false);
          }}
        >
          <div
            className="h-[90vh] w-[96vw] rounded-xl border border-border-subtle bg-background-elevated p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Full Corridor Map View</p>
              <button
                type="button"
                className="rounded border border-border-subtle px-3 py-1 text-xs text-foreground-muted hover:text-foreground"
                onClick={() => setIsExpanded(false)}
              >
                Close
              </button>
            </div>
            <div className="h-[calc(100%-36px)] rounded-lg border border-border-subtle bg-background-muted p-2">
              {renderMapCanvas()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
