import { StatusBadge } from "@/components/ui/status-badge";

interface KPIStatCardProps {
  label: string;
  value: string;
  deltaText?: string;
  status?: "success" | "warning" | "danger" | "info" | "neutral";
}

export function KPIStatCard({
  label,
  value,
  deltaText,
  status = "info",
}: KPIStatCardProps) {
  return (
    <article className="panel card-regular relative overflow-hidden">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <p className="type-label">{label}</p>
        <StatusBadge variant={status} label={status} size="md" />
      </div>
      <p className="type-kpi mt-2">{value}</p>
      {deltaText ? (
        <p className="mt-2 rounded-lg border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground-muted">
          {deltaText}
        </p>
      ) : null}
    </article>
  );
}
