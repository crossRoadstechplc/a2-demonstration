import { StatusBadge } from "@/components/ui/status-badge";
import type { Station } from "@/types/station";

interface StationOverviewCardProps {
  station?: Station;
}

export function StationOverviewCard({ station }: StationOverviewCardProps) {
  return (
    <article className="panel card-regular">
      <div className="mb-3 flex items-center justify-between">
        <p className="type-label">1) Station Overview</p>
        <StatusBadge
          label={station?.status ?? "Unknown"}
          variant={station?.status === "ACTIVE" ? "success" : "neutral"}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm text-foreground-muted md:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs uppercase">Name</p>
          <p className="mt-1 text-foreground">{station?.name ?? "N/A"}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs uppercase">Location</p>
          <p className="mt-1 text-foreground">{station?.location ?? "N/A"}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs uppercase">Capacity</p>
          <p className="mt-1 text-foreground">{station?.capacity ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
          <p className="text-xs uppercase">Operating Status</p>
          <p className="mt-1 text-foreground">{station?.operatingStatus ?? station?.status ?? "N/A"}</p>
        </div>
      </div>
    </article>
  );
}
