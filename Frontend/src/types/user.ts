import type { APP_ROLES } from "@/constants/roles";

export type AppRole = (typeof APP_ROLES)[number];

export interface User {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  organizationId: string | null;
  createdAt: string;
}
