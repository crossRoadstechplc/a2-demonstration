"use client";

import type { ReactNode } from "react";

import { ToastViewport } from "@/components/ui/toast-viewport";
import { AuthHydrator } from "./auth-hydrator";
import { QueryProvider } from "./query-provider";
import { ThemeHydrator } from "./theme-hydrator";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeHydrator />
      <AuthHydrator />
      {children}
      <ToastViewport />
    </QueryProvider>
  );
}
