"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { LOGIN_ROUTE } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { LoadingState } from "@/components/ui/loading-state";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`${LOGIN_ROUTE}?next=${next}`);
    }
  }, [isHydrated, isAuthenticated, router, pathname]);

  if (!isHydrated) {
    return <LoadingState label="Preparing session..." />;
  }

  if (!isAuthenticated) {
    return <LoadingState label="Redirecting to login..." />;
  }

  return <>{children}</>;
}
