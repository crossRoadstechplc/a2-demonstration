"use client";

import type { ReactNode } from "react";

import { AsyncActionButton } from "./async-action-button";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirming?: boolean;
  children?: ReactNode;
}

export function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  confirming = false,
  children,
}: ConfirmModalProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="panel w-full max-w-md p-5">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-foreground-muted">{message}</p>
        {children ? <div className="mt-3">{children}</div> : null}
        <div className="mt-5 flex justify-end gap-2">
          <AsyncActionButton label="Cancel" onClick={onCancel} variant="outline" />
          <AsyncActionButton
            label={confirmLabel}
            loadingLabel="Processing..."
            loading={confirming}
            onClick={onConfirm}
            variant="primary"
          />
        </div>
      </div>
    </div>
  );
}
