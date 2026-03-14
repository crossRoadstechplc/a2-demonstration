"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrganizationIdAsNumber = getOrganizationIdAsNumber;
exports.isAdminOrA2Operator = isAdminOrA2Operator;
exports.isAdminOrA2OrFleetOwner = isAdminOrA2OrFleetOwner;
exports.isAdminOrA2OrStationOperator = isAdminOrA2OrStationOperator;
function getOrganizationIdAsNumber(req) {
    if (!req.user?.organizationId) {
        return null;
    }
    const value = Number(req.user.organizationId);
    return Number.isNaN(value) ? null : value;
}
function isAdminOrA2Operator(req) {
    return req.user?.role === "ADMIN" || req.user?.role === "A2_OPERATOR";
}
function isAdminOrA2OrFleetOwner(req) {
    return (req.user?.role === "ADMIN" ||
        req.user?.role === "A2_OPERATOR" ||
        req.user?.role === "FLEET_OWNER");
}
function isAdminOrA2OrStationOperator(req) {
    return (req.user?.role === "ADMIN" ||
        req.user?.role === "A2_OPERATOR" ||
        req.user?.role === "STATION_OPERATOR");
}
