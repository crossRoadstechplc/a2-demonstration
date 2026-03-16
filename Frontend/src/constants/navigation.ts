import type { AppRole } from "@/types/user";

export interface NavItem {
  label: string;
  href: string;
  allowedRoles: AppRole[];
}

export interface SidebarSectionConfig {
  title: string;
  items: NavItem[];
}

const ALL_ROLES: AppRole[] = [
  "ADMIN",
  "A2_OPERATOR",
  "STATION_OPERATOR",
  "FLEET_OWNER",
  "DRIVER",
  "FREIGHT_CUSTOMER",
  "EEU_OPERATOR",
];

export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    title: "Operations",
    items: [
      { label: "A2 Command", href: "/a2", allowedRoles: ["ADMIN", "A2_OPERATOR"] },
      {
        label: "Station Operations",
        href: "/station",
        allowedRoles: ["ADMIN", "A2_OPERATOR", "STATION_OPERATOR"],
      },
      {
        label: "Fleet Operations",
        href: "/fleet",
        allowedRoles: ["ADMIN", "A2_OPERATOR", "FLEET_OWNER"],
      },
      {
        label: "Driver Operations",
        href: "/driver",
        allowedRoles: ["ADMIN", "A2_OPERATOR", "DRIVER"],
      },
    ],
  },
  {
    title: "Commercial",
    items: [
      {
        label: "Freight Portal",
        href: "/freight",
        allowedRoles: ["ADMIN", "A2_OPERATOR", "FREIGHT_CUSTOMER"],
      },
      {
        label: "EEU Grid Operations",
        href: "/eeu",
        allowedRoles: ["ADMIN", "A2_OPERATOR", "EEU_OPERATOR"],
      },
    ],
  },
  {
    title: "System",
    items: [{ label: "Logout", href: "/login", allowedRoles: ALL_ROLES }],
  },
];

export const ROLE_DISPLAY_NAME: Record<AppRole, string> = {
  ADMIN: "Admin",
  A2_OPERATOR: "A2 Operator",
  STATION_OPERATOR: "Station Operator",
  FLEET_OWNER: "Fleet Owner",
  DRIVER: "Driver",
  FREIGHT_CUSTOMER: "Freight Customer",
  EEU_OPERATOR: "EEU Operator",
};
