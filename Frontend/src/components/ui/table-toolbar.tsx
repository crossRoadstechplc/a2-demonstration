import type { ReactNode } from "react";

interface TableToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
}

export function TableToolbar({ left, right }: TableToolbarProps) {
  return (
    <div className="panel card-tight flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
