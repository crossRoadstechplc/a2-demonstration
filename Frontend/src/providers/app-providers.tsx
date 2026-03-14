"use client";

import type { ReactNode } from "react";

import { ToastViewport } from "@/components/ui/toast-viewport";
import { AuthHydrator } from "./auth-hydrator";
import { QueryProvider } from "./query-provider";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <AuthHydrator />
      {children}
      <ToastViewport />
    </QueryProvider>
  );
}
