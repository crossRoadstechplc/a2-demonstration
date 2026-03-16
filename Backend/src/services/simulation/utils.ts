/**
 * Shared utility functions for simulation phases
 */

import type { LatLng, StationRow } from "./types";

export const stationCoordinateByName: Record<string, LatLng> = {
  "Addis Ababa (Main Hub)": { lat: 8.9806, lng: 38.7578 },
  Adama: { lat: 8.54, lng: 39.27 },
  Awash: { lat: 8.98, lng: 40.17 },
  Mieso: { lat: 9.24, lng: 40.75 },
  "Dire Dawa": { lat: 9.6, lng: 41.86 },
  "Semera / Mille area": { lat: 11.79, lng: 41.01 },
  "Djibouti Port Gateway": { lat: 11.58, lng: 43.15 },
};

export function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function getStationCoordinate(station: StationRow): LatLng {
  return stationCoordinateByName[station.name] ?? { lat: 9.2, lng: 40.2 };
}

export function interpolatePoint(start: LatLng, end: LatLng, progress: number): LatLng {
  return {
    lat: round2(lerp(start.lat, end.lat, progress)),
    lng: round2(lerp(start.lng, end.lng, progress)),
  };
}

export function findNextStationId(
  currentStationId: number | null,
  stationIds: number[]
): number {
  if (stationIds.length === 0) {
    return 0;
  }

  if (currentStationId === null) {
    return stationIds[0];
  }

  const currentIndex = stationIds.indexOf(currentStationId);
  if (currentIndex === -1) {
    return stationIds[0];
  }

  return stationIds[(currentIndex + 1) % stationIds.length];
}
