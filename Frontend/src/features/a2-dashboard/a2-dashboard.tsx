"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { MapCardShell } from "@/components/dashboard/map-card-shell";
import { TrendCard } from "@/components/dashboard/trend-card";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useSmartPolling, useWebSocketLive } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";

import { A2DashboardSkeleton } from "./a2-dashboard-skeleton";
import { normalizeKpis, normalizeLiveEvents, normalizeStationPowerSummary } from "./normalize";

function formatEtb(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

function formatKwh(value: number): string {
  return `${Math.round(value).toLocaleString()} kWh`;
}

export function A2Dashboard() {
  const [queryText, setQueryText] = useState("");
  const [timeWindow, setTimeWindow] = useState("today");
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const setLiveUpdatesEnabled = useUiStore((state) => state.setLiveUpdatesEnabled);

  const a2SummaryQuery = appQueries.useA2Summary();
  const liveFeedQuery = appQueries.useA2LiveFeed();
  const billingA2Query = appQueries.useBillingSummaryA2();
  const billingStationsQuery = appQueries.useBillingSummaryStations();

  const isLoading =
    a2SummaryQuery.isLoading ||
    liveFeedQuery.isLoading ||
    billingA2Query.isLoading ||
    billingStationsQuery.isLoading;

  const hasError =
    a2SummaryQuery.isError ||
    liveFeedQuery.isError ||
    billingA2Query.isError ||
    billingStationsQuery.isError;

  const stationRows = useMemo(
    () => normalizeStationPowerSummary(billingStationsQuery.data),
    [billingStationsQuery.data]
  );
  const filteredStations = useMemo(
    () =>
      stationRows.filter((row) =>
        row.stationName.toLowerCase().includes(queryText.trim().toLowerCase())
      ),
    [stationRows, queryText]
  );

  const kpis = useMemo(
    () => normalizeKpis(a2SummaryQuery.data, liveFeedQuery.data, billingA2Query.data),
    [a2SummaryQuery.data, liveFeedQuery.data, billingA2Query.data]
  );

  const events = useMemo(() => normalizeLiveEvents(liveFeedQuery.data), [liveFeedQuery.data]);

  const isRefreshing =
    a2SummaryQuery.isFetching ||
    liveFeedQuery.isFetching ||
    billingA2Query.isFetching ||
    billingStationsQuery.isFetching;

  const liveStatus = useSmartPolling({
    queries: [a2SummaryQuery, liveFeedQuery, billingA2Query, billingStationsQuery],
    enabled: liveUpdatesEnabled,
    intervalMs: 10_000,
  });

  useWebSocketLive({
    url: process.env.NEXT_PUBLIC_LIVE_WS_URL ?? null,
    enabled: liveUpdatesEnabled && Boolean(process.env.NEXT_PUBLIC_LIVE_WS_URL),
    onMessage: () => {
      void liveFeedQuery.refetch();
      void a2SummaryQuery.refetch();
      void billingStationsQuery.refetch();
    },
  });

  async function onRefresh() {
    await Promise.all([
      a2SummaryQuery.refetch(),
      liveFeedQuery.refetch(),
      billingA2Query.refetch(),
      billingStationsQuery.refetch(),
    ]);
  }

  if (isLoading) {
    return <A2DashboardSkeleton />;
  }

  if (hasError) {
    return (
      <div className="dashboard-grid grid-cols-1">
        <ErrorState
          title="Unable to load A2 HQ dashboard"
          message="One or more dashboard data requests failed."
        />
        <AsyncActionButton label="Retry refresh" onClick={onRefresh} className="w-fit" />
      </div>
    );
  }

  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="A2 HQ / Network Operations"
        title="Executive + Operations Command Dashboard"
        description="Real-time corridor visibility across swaps, charging, queues, incidents, and revenue."
        actions={
          <AsyncActionButton
            label="Refresh"
            loading={isRefreshing}
            loadingLabel="Refreshing..."
            onClick={onRefresh}
          />
        }
      />

      <FilterBar>
        <SearchInput
          placeholder="Filter station-based panels"
          value={queryText}
          onChange={setQueryText}
        />
        <select
          value={timeWindow}
          onChange={(event) => setTimeWindow(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground outline-none focus:border-accent"
        >
          <option value="today">Today</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
        </select>
        <StatusBadge label="Live Feed 30s" variant="info" />
        <LiveRefreshIndicator {...liveStatus} />
        <label className="flex items-center gap-2 text-xs text-foreground-muted">
          <input
            type="checkbox"
            checked={liveUpdatesEnabled}
            onChange={(event) => setLiveUpdatesEnabled(event.target.checked)}
          />
          Auto live
        </label>
      </FilterBar>

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5">
        <KPIStatCard label="Active Trucks" value={String(kpis.activeTrucks)} status="success" />
        <KPIStatCard label="Swaps Today" value={String(kpis.swapsToday)} status="info" />
        <KPIStatCard
          label="Batteries Ready"
          value={String(kpis.batteriesReady)}
          status="success"
        />
        <KPIStatCard
          label="Charging Active"
          value={String(kpis.chargingSessionsActive)}
          status="warning"
        />
        <KPIStatCard
          label="Corridor Energy Today"
          value={formatKwh(kpis.corridorEnergyToday)}
          status="info"
        />
        <KPIStatCard
          label="Corridor Revenue"
          value={formatEtb(kpis.corridorRevenueEtb)}
          status="neutral"
        />
        <KPIStatCard label="A2 Share" value={formatEtb(kpis.a2ShareEtb)} status="success" />
        <KPIStatCard label="EEU Share" value={formatEtb(kpis.eeuShareEtb)} status="info" />
        <KPIStatCard
          label="VAT Collected"
          value={formatEtb(kpis.vatCollectedEtb)}
          status="warning"
        />
        <KPIStatCard
          label="Stations Online"
          value={String(kpis.stationsOnline)}
          status="success"
        />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapCardShell title="1) Real-time Network Map Panel">
            <div className="h-full rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_30%_30%,rgba(35,201,255,0.18),transparent_45%),linear-gradient(180deg,#0b1322,#09101c)] p-4">
              <p className="type-label">Corridor A2 / Station signal route</p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {filteredStations.slice(0, 8).map((station) => (
                  <div
                    key={station.stationName}
                    className="rounded-lg border border-border-subtle bg-background/70 px-2 py-2 text-xs"
                  >
                    <p className="font-semibold text-foreground">{station.stationName}</p>
                    <p className="text-foreground-muted">{station.utilizationPct}% utilization</p>
                  </div>
                ))}
              </div>
            </div>
          </MapCardShell>
        </div>

        <article className="panel card-regular">
          <div className="mb-3 flex items-center justify-between">
            <p className="type-label">2) Live Swap Activity Feed</p>
            <StatusBadge label="Live" variant="info" />
          </div>
          <div className="space-y-2">
            {events.swapEvents.length === 0 ? (
              <EmptyPlaceholder title="No swap events yet" />
            ) : (
              events.swapEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-foreground-muted">{event.detail}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <ChartCard title="3) Station Utilization Overview" subtitle={`${timeWindow} utilization`} />
        <ChartCard title="4) Battery Inventory Across Stations" subtitle="Ready/charging stock view" />
        <ChartCard title="5) Corridor Charging Activity" subtitle="Active sessions by station" />
        <TrendCard title="6) Truck Movement Summary" subtitle="Corridor movement and route activity" />
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">7) Queue and Congestion Alerts</p>
          <div className="mt-3 space-y-2">
            {events.incidents.length === 0 ? (
              <EmptyPlaceholder title="No congestion alerts" />
            ) : (
              events.incidents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <StatusBadge label={event.severity} variant={event.severity} />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">{event.detail}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">8) Operational Incidents Feed</p>
          <div className="mt-3 space-y-2">
            {events.incidents.length === 0 ? (
              <EmptyPlaceholder title="No incidents reported" />
            ) : (
              events.incidents.map((event) => (
                <div key={event.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm text-foreground">{event.detail}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{event.timestamp}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <DataTableWrapper
          title="10) Power Consumption by Station"
          className="xl:col-span-2"
        >
          <TableToolbar
            left={<StatusBadge label={`${filteredStations.length} Stations`} variant="neutral" />}
            right={<StatusBadge label={timeWindow.toUpperCase()} variant="info" />}
          />

          <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2">Power (kWh)</th>
                  <th className="px-3 py-2">Revenue (ETB)</th>
                  <th className="px-3 py-2">Utilization</th>
                  <th className="px-3 py-2">Ready Bat</th>
                  <th className="px-3 py-2">Queue</th>
                </tr>
              </thead>
              <tbody>
                {filteredStations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6">
                      <EmptyPlaceholder title="No station summary data" />
                    </td>
                  </tr>
                ) : (
                  filteredStations.map((row) => (
                    <tr key={row.stationName} className="border-t border-border-subtle">
                      <td className="px-3 py-2 text-foreground">{row.stationName}</td>
                      <td className="px-3 py-2 text-foreground-muted">{row.powerKwh}</td>
                      <td className="px-3 py-2 text-foreground-muted">
                        {Math.round(row.revenueEtb).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{row.utilizationPct}%</td>
                      <td className="px-3 py-2 text-foreground-muted">{row.batteriesReady}</td>
                      <td className="px-3 py-2 text-foreground-muted">{row.queueCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataTableWrapper>

        <article className="panel card-regular">
          <p className="type-label">9) Revenue Summary Panel</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Total Corridor Revenue</p>
              <p className="text-lg font-semibold text-foreground">
                {formatEtb(kpis.corridorRevenueEtb)}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">A2 Share</p>
              <p className="text-lg font-semibold text-success">{formatEtb(kpis.a2ShareEtb)}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">EEU Share</p>
              <p className="text-lg font-semibold text-info">{formatEtb(kpis.eeuShareEtb)}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="type-label">11) A2 Live Feed Panel</p>
            <div className="mt-2 space-y-2">
              {events.a2LiveFeed.length === 0 ? (
                <EmptyPlaceholder title="No live feed events yet" />
              ) : (
                events.a2LiveFeed.slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-border-subtle px-2 py-2 text-xs"
                  >
                    <p className="text-foreground">{event.detail}</p>
                    <p className="mt-1 text-foreground-muted">{event.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
