"use strict";
/**
 * Shared utility functions for simulation phases
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stationCoordinateByName = void 0;
exports.round2 = round2;
exports.randomInt = randomInt;
exports.lerp = lerp;
exports.getStationCoordinate = getStationCoordinate;
exports.interpolatePoint = interpolatePoint;
exports.findNextStationId = findNextStationId;
exports.stationCoordinateByName = {
    "Addis Ababa (Main Hub)": { lat: 8.9806, lng: 38.7578 },
    Adama: { lat: 8.54, lng: 39.27 },
    Awash: { lat: 8.98, lng: 40.17 },
    Mieso: { lat: 9.24, lng: 40.75 },
    "Dire Dawa": { lat: 9.6, lng: 41.86 },
    "Semera / Mille area": { lat: 11.79, lng: 41.01 },
    "Djibouti Port Gateway": { lat: 11.58, lng: 43.15 },
};
function round2(value) {
    return Number(value.toFixed(2));
}
function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
}
function lerp(from, to, progress) {
    return from + (to - from) * progress;
}
function getStationCoordinate(station) {
    return exports.stationCoordinateByName[station.name] ?? { lat: 9.2, lng: 40.2 };
}
function interpolatePoint(start, end, progress) {
    return {
        lat: round2(lerp(start.lat, end.lat, progress)),
        lng: round2(lerp(start.lng, end.lng, progress)),
    };
}
function findNextStationId(currentStationId, stationIds) {
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
