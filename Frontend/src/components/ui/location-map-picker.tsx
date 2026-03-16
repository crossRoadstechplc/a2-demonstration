"use client";

import { useState, useCallback } from "react";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
import { cn } from "@/lib/utils";

interface LocationMapPickerProps {
  value: { label: string; lat: number | null; lng: number | null };
  onChange: (value: { label: string; lat: number; lng: number }) => void;
  label: string;
  error?: string;
  stations?: Array<{ id: number; name: string; location: string }>;
  trucks?: Array<{ id: number; locationLat: number | null; locationLng: number | null }>;
  batteries?: Array<unknown>;
}

const CORRIDOR_BOUNDS = {
  minLat: 8.5,
  maxLat: 12.0,
  minLng: 38.5,
  maxLng: 43.5,
};

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findNearestStation(
  lat: number,
  lng: number,
  stations?: Array<{ id: number; name: string; location: string }>
): string {
  if (!stations || stations.length === 0) {
    const corridorStations = [
      { name: "Addis Ababa (Main Hub)", lat: 8.9806, lng: 38.7578 },
      { name: "Adama", lat: 8.54, lng: 39.27 },
      { name: "Awash", lat: 8.98, lng: 40.17 },
      { name: "Mieso", lat: 9.24, lng: 40.75 },
      { name: "Dire Dawa", lat: 9.6, lng: 41.86 },
      { name: "Semera / Mille area", lat: 11.79, lng: 41.01 },
      { name: "Djibouti Port Gateway", lat: 11.58, lng: 43.15 },
    ];
    let nearest = corridorStations[0];
    let minDist = haversineDistance(lat, lng, nearest.lat, nearest.lng);
    for (const station of corridorStations.slice(1)) {
      const dist = haversineDistance(lat, lng, station.lat, station.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = station;
      }
    }
    return nearest.name;
  }

  const stationCoords: Array<{ name: string; lat: number; lng: number }> = stations.map((s) => {
    const knownCoords: Record<string, { lat: number; lng: number }> = {
      "Addis Ababa (Main Hub)": { lat: 8.9806, lng: 38.7578 },
      Adama: { lat: 8.54, lng: 39.27 },
      Awash: { lat: 8.98, lng: 40.17 },
      Mieso: { lat: 9.24, lng: 40.75 },
      "Dire Dawa": { lat: 9.6, lng: 41.86 },
      "Semera / Mille area": { lat: 11.79, lng: 41.01 },
      "Djibouti Port Gateway": { lat: 11.58, lng: 43.15 },
    };
    const coords = knownCoords[s.name] ?? { lat: 9.0, lng: 40.0 };
    return { name: s.name, ...coords };
  });

  let nearest = stationCoords[0];
  let minDist = haversineDistance(lat, lng, nearest.lat, nearest.lng);
  for (const station of stationCoords.slice(1)) {
    const dist = haversineDistance(lat, lng, station.lat, station.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }
  return nearest.name;
}

export function LocationMapPicker({
  value,
  onChange,
  label,
  error,
  stations,
  trucks,
  batteries,
}: LocationMapPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number } | null>(
    value.lat !== null && value.lng !== null ? { lat: value.lat, lng: value.lng } : null
  );
  const gradientId = `corridorBand-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const gradientIdPreview = `${gradientId}-preview`;

  const handleMapClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = event.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert SVG coordinates to lat/lng
      // Map viewBox is 0 0 900 420
      const viewBoxWidth = 900;
      const viewBoxHeight = 420;
      const svgX = (x / rect.width) * viewBoxWidth;
      const svgY = (y / rect.height) * viewBoxHeight;

      // Corridor bounds in SVG space (approximate)
      const minX = 70;
      const maxX = 850;
      const minY = 150;
      const maxY = 270;

      if (svgX < minX || svgX > maxX || svgY < minY || svgY > maxY) {
        return; // Click outside corridor
      }

      // Convert to lat/lng (linear interpolation)
      const t = (svgX - minX) / (maxX - minX);
      const lng = 38.7578 + t * (43.15 - 38.7578);
      const lat = 8.98 + (svgY - minY) / (maxY - minY) * (11.79 - 8.98);

      // Clamp to corridor bounds
      const clampedLat = Math.max(CORRIDOR_BOUNDS.minLat, Math.min(CORRIDOR_BOUNDS.maxLat, lat));
      const clampedLng = Math.max(CORRIDOR_BOUNDS.minLng, Math.min(CORRIDOR_BOUNDS.maxLng, lng));

      setTempCoords({ lat: clampedLat, lng: clampedLng });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (tempCoords) {
      const nearestStation = findNearestStation(tempCoords.lat, tempCoords.lng, stations);
      onChange({ label: nearestStation, lat: tempCoords.lat, lng: tempCoords.lng });
      setIsOpen(false);
    }
  }, [tempCoords, onChange, stations]);

  const handleCancel = useCallback(() => {
    setTempCoords(value.lat !== null && value.lng !== null ? { lat: value.lat, lng: value.lng } : null);
    setIsOpen(false);
  }, [value]);

  const mapX = value.lat !== null && value.lng !== null
    ? 70 + ((value.lng - 38.7578) / (43.15 - 38.7578)) * 780
    : null;
  const mapY = value.lat !== null && value.lng !== null
    ? 210 + ((value.lat - 8.98) / (11.79 - 8.98)) * 60
    : null;

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div
          className={cn(
            "relative rounded-xl border border-border-subtle bg-background-muted overflow-hidden cursor-pointer group",
            error && "border-danger"
          )}
          onClick={() => setIsOpen(true)}
        >
          <div className="h-32 w-full relative">
            <svg viewBox="0 0 900 420" className="h-full w-full">
              <rect width="900" height="420" fill="#080c10" />
              <defs>
                <linearGradient id={gradientIdPreview} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path
                d="M 70,210 L 850,210"
                stroke={`url(#${gradientIdPreview})`}
                strokeWidth="24"
                fill="none"
                opacity="0.45"
              />
              {mapX !== null && mapY !== null && (
                <g>
                  <circle cx={mapX} cy={mapY} r="6" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                  <circle
                    cx={mapX}
                    cy={mapY}
                    r="12"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1"
                    opacity="0.6"
                  >
                    <animate attributeName="r" values="12;18;12" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 group-hover:bg-background/20 transition-colors">
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">
                  {value.label || "Click to select location"}
                </p>
                {value.lat !== null && value.lng !== null && (
                  <p className="text-[10px] text-foreground-muted mt-0.5">
                    {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div
            className="w-full max-w-4xl rounded-xl border border-border-subtle bg-background-elevated p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Select {label}</p>
                <p className="text-xs text-foreground-muted">Click on the map to choose a location</p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded border border-border-subtle px-3 py-1 text-xs text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <div className="relative h-96 rounded-lg border border-border-subtle bg-background-muted">
              <svg
                viewBox="0 0 900 420"
                className="h-full w-full cursor-crosshair"
                onClick={handleMapClick}
              >
                <rect width="900" height="420" fill="#080c10" />
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
                    <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.12" />
                  </linearGradient>
                </defs>
                <path
                  d="M 70,210 L 850,210"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="24"
                  fill="none"
                  opacity="0.45"
                />
                {tempCoords && (
                  <g>
                    <circle
                      cx={70 + ((tempCoords.lng - 38.7578) / (43.15 - 38.7578)) * 780}
                      cy={210 + ((tempCoords.lat - 8.98) / (11.79 - 8.98)) * 60}
                      r="8"
                      fill="#f59e0b"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                    <circle
                      cx={70 + ((tempCoords.lng - 38.7578) / (43.15 - 38.7578)) * 780}
                      cy={210 + ((tempCoords.lat - 8.98) / (11.79 - 8.98)) * 60}
                      r="16"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      opacity="0.5"
                    >
                      <animate attributeName="r" values="16;24;16" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}
              </svg>
            </div>
            {tempCoords && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-background-muted px-3 py-2">
                <div>
                  <p className="text-xs text-foreground-muted">Selected location</p>
                  <p className="text-sm font-medium text-foreground">
                    {findNearestStation(tempCoords.lat, tempCoords.lng, stations)} ({tempCoords.lat.toFixed(4)},{" "}
                    {tempCoords.lng.toFixed(4)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded-xl border border-success bg-success/10 px-4 py-2 text-sm font-medium text-success hover:bg-success/20"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
