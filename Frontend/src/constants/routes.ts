import type { AppRole } from "@/types/user";

export const LOGIN_ROUTE = "/login";
export const UNAUTHORIZED_ROUTE = "/unauthorized";

export const ROLE_HOME_ROUTE: Record<AppRole, string> = {
  ADMIN: "/a2",
  A2_OPERATOR: "/a2",
  STATION_OPERATOR: "/station",
  FLEET_OWNER: "/fleet",
  DRIVER: "/driver",
  FREIGHT_CUSTOMER: "/freight",
  EEU_OPERATOR: "/eeu",
};

export const ROLE_ROUTE_ACCESS: Record<string, AppRole[]> = {
  a2: ["ADMIN", "A2_OPERATOR"],
  station: ["ADMIN", "A2_OPERATOR", "STATION_OPERATOR"],
  driver: ["ADMIN", "A2_OPERATOR", "DRIVER"],
  fleet: ["ADMIN", "A2_OPERATOR", "FLEET_OWNER"],
  freight: ["ADMIN", "A2_OPERATOR", "FREIGHT_CUSTOMER"],
  eeu: ["ADMIN", "A2_OPERATOR", "EEU_OPERATOR"],
};

export function getAllowedRolesForPath(pathname: string): AppRole[] | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  return ROLE_ROUTE_ACCESS[firstSegment] ?? null;
}

export function canRoleAccessPath(role: AppRole, pathname: string): boolean {
  const allowedRoles = getAllowedRolesForPath(pathname);
  if (!allowedRoles) {
    return true;
  }
  return allowedRoles.includes(role);
}
