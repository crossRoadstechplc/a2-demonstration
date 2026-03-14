import { StatusBadge } from "@/components/ui/status-badge";

const mockFeed = [
  { id: "1", type: "success", text: "Swap completed for TRK-019", time: "2m ago" },
  { id: "2", type: "warning", text: "Charging queue at STN-003", time: "7m ago" },
  { id: "3", type: "danger", text: "Charger fault at Bay 3", time: "13m ago" },
] as const;

export function ActivityFeedCard() {
  return (
    <article className="panel card-regular">
      <div className="mb-3 flex items-center justify-between">
        <p className="type-label">Live Transactions</p>
        <StatusBadge label="Live" variant="info" />
      </div>
      <div className="space-y-2">
        {mockFeed.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
          >
            <p className="text-sm text-foreground">{item.text}</p>
            <p className="mt-1 text-xs text-foreground-muted">{item.time}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
