import type { Request } from "express";

export function getOrganizationIdAsNumber(req: Request): number | null {
  if (!req.user?.organizationId) {
    return null;
  }
  const value = Number(req.user.organizationId);
  return Number.isNaN(value) ? null : value;
}

export function isAdminOrA2Operator(req: Request): boolean {
  return req.user?.role === "ADMIN" || req.user?.role === "A2_OPERATOR";
}

export function isAdminOrA2OrFleetOwner(req: Request): boolean {
  return (
    req.user?.role === "ADMIN" ||
    req.user?.role === "A2_OPERATOR" ||
    req.user?.role === "FLEET_OWNER"
  );
}

export function isAdminOrA2OrStationOperator(req: Request): boolean {
  return (
    req.user?.role === "ADMIN" ||
    req.user?.role === "A2_OPERATOR" ||
    req.user?.role === "STATION_OPERATOR"
  );
}
