export const USER_ROLES = [
  "ADMIN",
  "A2_OPERATOR",
  "STATION_OPERATOR",
  "FLEET_OWNER",
  "DRIVER",
  "FREIGHT_CUSTOMER",
  "EEU_OPERATOR"
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId: string | null;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  createdAt: string;
}
