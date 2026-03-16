import { StatusBadge } from "@/components/ui/status-badge";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
import type { Battery } from "@/types/battery";
import type { Station } from "@/types/station";
import type { Truck } from "@/types/truck";

interface StationOverviewCardProps {
  station?: Station;
  stations?: Station[];
  trucks?: Truck[];
  batteries?: Battery[];
}

export function StationOverviewCard({
  station,
  stations,
  trucks,
  batteries,
}: StationOverviewCardProps) {
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
      <div className="mt-3 h-64">
        <OperationsCorridorMap
          stations={stations}
          trucks={trucks}
          batteries={batteries}
          highlightedStationId={station?.id ?? null}
        />
      </div>
    </article>
  );
}
