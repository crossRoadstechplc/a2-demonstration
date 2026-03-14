"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { UNAUTHORIZED_ROUTE } from "@/constants/routes";
import { useRole } from "@/hooks/use-role";
import type { AppRole } from "@/types/user";
import { LoadingState } from "@/components/ui/loading-state";

interface RoleGuardProps {
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const { role } = useRole();

  useEffect(() => {
    if (!role) {
      return;
    }

    if (!allowedRoles.includes(role)) {
      router.replace(UNAUTHORIZED_ROUTE);
    }
  }, [role, allowedRoles, router]);

  if (!role) {
    return <LoadingState label="Checking access..." />;
  }

  if (!allowedRoles.includes(role)) {
    return <LoadingState label="Redirecting to unauthorized page..." />;
  }

  return <>{children}</>;
}
