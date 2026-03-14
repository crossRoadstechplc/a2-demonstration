export const APP_ROLES = [
  "ADMIN",
  "A2_OPERATOR",
  "STATION_OPERATOR",
  "FLEET_OWNER",
  "DRIVER",
  "FREIGHT_CUSTOMER",
  "EEU_OPERATOR",
] as const;

export const DASHBOARD_ROUTES = [
  { label: "A2", href: "/a2" },
  { label: "Station", href: "/station" },
  { label: "Driver", href: "/driver" },
  { label: "Fleet", href: "/fleet" },
  { label: "Freight", href: "/freight" },
  { label: "EEU", href: "/eeu" },
] as const;
