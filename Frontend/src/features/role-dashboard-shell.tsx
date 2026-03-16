import { ActivityFeedCard } from "@/components/dashboard/activity-feed-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { MapCardShell } from "@/components/dashboard/map-card-shell";
import { TrendCard } from "@/components/dashboard/trend-card";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingSkeletons } from "@/components/ui/loading-skeletons";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableToolbar } from "@/components/ui/table-toolbar";

interface RoleDashboardShellProps {
  roleLabel: string;
  subtitle: string;
}

export function RoleDashboardShell({ roleLabel, subtitle }: RoleDashboardShellProps) {
  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="A2 Corridor / Control Layer"
        title={`${roleLabel} Dashboard Shell`}
        description={subtitle}
        actions={null}
      />

      <FilterBar>
        <SearchInput placeholder={`Search ${roleLabel.toLowerCase()} view`} />
        <button className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground-muted hover:text-foreground">
          Today
        </button>
        <button className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground-muted hover:text-foreground">
          Live Auto Refresh
        </button>
      </FilterBar>

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard label="Trucks Active" value="48" deltaText="+3 vs yesterday" status="success" />
        <KPIStatCard label="Swaps Today" value="130" deltaText="+12% on target" status="info" />
        <KPIStatCard label="Batteries Ready" value="214" deltaText="of 312 total fleet" status="success" />
        <KPIStatCard label="Incidents" value="2" deltaText="STN-004 and STN-009" status="danger" />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapCardShell title="Network Corridor / Map Shell" />
        </div>
        <ActivityFeedCard />
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <ChartCard title="Energy Consumption (24H)" subtitle="Chart container style placeholder" />
        <TrendCard title="Network Trend" subtitle="Utilization and queue variation" />
      </section>

      <TableToolbar
        left={<StatusBadge label="Table Shell" variant="neutral" />}
        right={<SearchInput placeholder="Filter table rows" />}
      />
      <EmptyPlaceholder
        title="No business-specific rows yet"
        description="This is a shell-only phase. Data table and widgets will be connected in next phases."
      />
      <LoadingSkeletons />
    </div>
  );
}
