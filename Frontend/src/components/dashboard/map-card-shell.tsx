import type { ReactNode } from "react";
import { OperationsCorridorMap } from "./operations-corridor-map";

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
        {children ?? <OperationsCorridorMap />}
      </div>
    </article>
  );
}
