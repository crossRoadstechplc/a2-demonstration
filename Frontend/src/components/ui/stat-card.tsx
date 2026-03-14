import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  className?: string;
}

export function StatCard({ label, value, delta, className }: StatCardProps) {
  return (
    <article className={cn("panel panel-padding", className)}>
      <p className="text-xs uppercase tracking-[0.14em] text-foreground-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
      {delta ? <p className="mt-2 text-xs text-accent">{delta}</p> : null}
    </article>
  );
}
