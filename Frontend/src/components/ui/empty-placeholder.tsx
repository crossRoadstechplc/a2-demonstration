import type { ReactNode } from "react";

interface EmptyPlaceholderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyPlaceholder({
  title,
  description = "No records found for this view.",
  action,
}: EmptyPlaceholderProps) {
  return (
    <div className="panel card-regular text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-background-muted text-xs text-foreground-muted">
        --
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-foreground-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
