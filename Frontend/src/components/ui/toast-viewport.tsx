"use client";

import { useNotificationStore } from "@/store/notification-store";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const colorMap = {
  success: "border-emerald-400/40 text-emerald-300",
  error: "border-red-400/40 text-red-300",
  info: "border-sky-400/40 text-sky-300",
} as const;

export function ToastViewport() {
  const toasts = useNotificationStore((state) => state.toasts);
  const dismiss = useNotificationStore((state) => state.dismiss);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismiss(toast.id), 3500)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[320px] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto panel rounded-xl px-3 py-2",
            colorMap[toast.type]
          )}
        >
          {toast.title ? (
            <p className="text-xs font-semibold uppercase tracking-wide">{toast.title}</p>
          ) : null}
          <p className="mt-1 text-sm text-foreground">{toast.message}</p>
          <button
            type="button"
            className="mt-2 text-xs text-foreground-muted hover:text-foreground"
            onClick={() => dismiss(toast.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
