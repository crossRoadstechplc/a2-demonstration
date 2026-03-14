import type { ReactNode } from "react";

interface MapCardShellProps {
  title?: string;
  children?: ReactNode;
}

export function MapCardShell({
  title = "Corridor Map",
  children,
}: MapCardShellProps) {
  return (
    <article className="panel card-regular">
      <p className="type-label">{title}</p>
      <div className="mt-4 h-[340px] rounded-xl border border-border-subtle bg-background-muted p-3">
        {children ?? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border-subtle">
            <p className="text-sm text-foreground-muted">Map canvas placeholder</p>
          </div>
        )}
      </div>
    </article>
  );
}
