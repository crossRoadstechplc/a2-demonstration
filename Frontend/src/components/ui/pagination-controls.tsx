import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  className,
}: PaginationControlsProps) {
  if (totalItems <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className={cn("mt-3 flex items-center justify-between", className)}>
      <p className="text-xs text-foreground-muted">
        {from}–{to} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!hasPrev}
          onClick={onPrev}
          className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-foreground-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="px-2 text-xs text-foreground-muted">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={!hasNext}
          onClick={onNext}
          className="rounded-lg border border-border-subtle px-3 py-1 text-xs text-foreground-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
