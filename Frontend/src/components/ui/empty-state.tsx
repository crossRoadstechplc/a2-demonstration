import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({
  title = "No data available",
  message = "Nothing to display yet.",
  action,
}: EmptyStateProps) {
  return (
    <div className="panel panel-padding text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-background-muted text-xs text-foreground-muted">
        0
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-foreground-muted">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
