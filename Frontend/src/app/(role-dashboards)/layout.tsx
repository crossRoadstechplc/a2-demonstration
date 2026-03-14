import type { ReactNode } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { RoleRouteGuard } from "@/components/guards/role-route-guard";
import { AppShell } from "@/components/layout/app-shell";

interface RoleDashboardsLayoutProps {
  children: ReactNode;
}

export default function RoleDashboardsLayout({
  children,
}: RoleDashboardsLayoutProps) {
  return (
    <AuthGuard>
      <RoleRouteGuard>
        <AppShell>{children}</AppShell>
      </RoleRouteGuard>
    </AuthGuard>
  );
}
