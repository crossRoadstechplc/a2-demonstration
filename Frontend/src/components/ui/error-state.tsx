import type { ReactNode } from "react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  action,
}: ErrorStateProps) {
  return (
    <div className="panel panel-padding border-danger/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-danger">{title}</h3>
          <p className="mt-1 text-sm text-foreground-muted">{message}</p>
        </div>
        <span className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-danger">
          Error
        </span>
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
