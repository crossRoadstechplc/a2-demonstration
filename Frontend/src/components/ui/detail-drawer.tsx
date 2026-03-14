"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function DetailDrawer({ open, title, onClose, children }: DetailDrawerProps) {
  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/55 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border-subtle bg-background-elevated p-4 shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-subtle px-2 py-1 text-xs text-foreground-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </aside>
    </>
  );
}
