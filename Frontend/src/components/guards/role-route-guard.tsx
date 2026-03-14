"use client";

import { usePathname } from "next/navigation";

import { RoleGuard } from "./role-guard";
import { getAllowedRolesForPath } from "@/constants/routes";

interface RoleRouteGuardProps {
  children: React.ReactNode;
}

export function RoleRouteGuard({ children }: RoleRouteGuardProps) {
  const pathname = usePathname();
  const allowedRoles = getAllowedRolesForPath(pathname);

  if (!allowedRoles) {
    return <>{children}</>;
  }

  return <RoleGuard allowedRoles={allowedRoles}>{children}</RoleGuard>;
}
