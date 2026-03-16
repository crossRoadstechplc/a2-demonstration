"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { MapCardShell } from "@/components/dashboard/map-card-shell";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
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

import { Tabs, TabPanel } from "@/components/ui/tabs";
import { A2DashboardSkeleton } from "./a2-dashboard-skeleton";
import {
  normalizeKpis,
  normalizeLiveEvents,
  normalizeStationPowerSummary,
  normalizeBatteryRows,
  normalizeFreightRows,
  deriveSystemHealth,
} from "./normalize";
import { deriveKpiStatus, KPI_THRESHOLDS_NOTE } from "./kpi-thresholds";

function formatEtb(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function A2Dashboard() {
  const [queryText, setQueryText] = useState("");
  const [timeWindow, setTimeWindow] = useState("today");
  const [activeTab, setActiveTab] = useState<"overview" | "batteries" | "freight" | "system-health">("overview");
  const [batterySearchText, setBatterySearchText] = useState("");
  const [batteryStatusFilter, setBatteryStatusFilter] = useState("ALL");
  const [freightStatusFilter, setFreightStatusFilter] = useState("ALL");
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const setLiveUpdatesEnabled = useUiStore((state) => state.setLiveUpdatesEnabled);

  const a2SummaryQuery = appQueries.useA2Summary();
  const a2ChartsQuery = appQueries.useA2Charts();
  const liveFeedQuery = appQueries.useA2LiveFeed();
  const billingA2Query = appQueries.useBillingSummaryA2();
  const billingStationsQuery = appQueries.useBillingSummaryStations();
  const stationsQuery = appQueries.useStations();
  const driversQuery = appQueries.useDrivers();
  const trucksQuery = appQueries.useTrucks();
  const batteriesQuery = appQueries.useBatteries();
  const shipmentsQuery = appQueries.useShipments();
  const swapsQuery = appQueries.useSwaps();

  const isLoading =
    stationsQuery.isLoading ||
    driversQuery.isLoading ||
    trucksQuery.isLoading ||
    batteriesQuery.isLoading ||
    shipmentsQuery.isLoading ||
    swapsQuery.isLoading ||
    a2SummaryQuery.isLoading ||
    liveFeedQuery.isLoading ||
    billingA2Query.isLoading ||
    billingStationsQuery.isLoading;

  const hasError =
    stationsQuery.isError ||
    driversQuery.isError ||
    trucksQuery.isError ||
    batteriesQuery.isError ||
    shipmentsQuery.isError ||
    swapsQuery.isError ||
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
  const kpiStatus = useMemo(() => deriveKpiStatus(kpis), [kpis]);

  const events = useMemo(() => normalizeLiveEvents(liveFeedQuery.data), [liveFeedQuery.data]);
  const driverTruckAssignments = useMemo(() => {
    const driverById = new Map((driversQuery.data ?? []).map((driver) => [driver.id, driver.name]));
    return (trucksQuery.data ?? [])
      .filter((truck) => truck.assignedDriverId)
      .map((truck) => ({
        truckId: truck.id,
        plateNumber: truck.plateNumber,
        driverName: driverById.get(truck.assignedDriverId ?? -1) ?? `Driver #${truck.assignedDriverId}`,
      }))
      .slice(0, 10);
  }, [driversQuery.data, trucksQuery.data]);

  const isRefreshing =
    a2SummaryQuery.isFetching ||
    liveFeedQuery.isFetching ||
    billingA2Query.isFetching ||
    billingStationsQuery.isFetching;

  const batteryRows = useMemo(
    () => normalizeBatteryRows(batteriesQuery.data ?? [], trucksQuery.data ?? [], stationsQuery.data ?? []),
    [batteriesQuery.data, trucksQuery.data, stationsQuery.data]
  );

  const filteredBatteries = useMemo(
    () =>
      batteryRows.filter((battery) => {
        if (batterySearchText.trim()) {
          const searchLower = batterySearchText.toLowerCase();
          if (!String(battery.id).toLowerCase().includes(searchLower)) return false;
        }
        if (batteryStatusFilter !== "ALL" && battery.status !== batteryStatusFilter) return false;
        return true;
      }),
    [batteryRows, batterySearchText, batteryStatusFilter]
  );

  const freightRows = useMemo(
    () => normalizeFreightRows(shipmentsQuery.data ?? [], trucksQuery.data ?? [], driversQuery.data ?? []),
    [shipmentsQuery.data, trucksQuery.data, driversQuery.data]
  );

  const filteredFreight = useMemo(
    () =>
      freightRows.filter((freight) => {
        if (freightStatusFilter !== "ALL" && freight.status !== freightStatusFilter) return false;
        return true;
      }),
    [freightRows, freightStatusFilter]
  );

  const systemHealth = useMemo(
    () => deriveSystemHealth(stationsQuery.data ?? [], trucksQuery.data ?? [], driversQuery.data ?? [], swapsQuery.data ?? []),
    [stationsQuery.data, trucksQuery.data, driversQuery.data, swapsQuery.data]
  );

  const liveStatus = useSmartPolling({
    queries: [
      stationsQuery,
      driversQuery,
      trucksQuery,
      batteriesQuery,
      shipmentsQuery,
      swapsQuery,
      a2SummaryQuery,
      liveFeedQuery,
      billingA2Query,
      billingStationsQuery,
    ],
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
      stationsQuery.refetch(),
      driversQuery.refetch(),
      trucksQuery.refetch(),
      batteriesQuery.refetch(),
      shipmentsQuery.refetch(),
      swapsQuery.refetch(),
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
        <KPIStatCard
          label="Active Trucks"
          value={String(kpis.activeTrucks)}
          status={kpiStatus.activeTrucks}
        />
        <KPIStatCard
          label="Swaps Today"
          value={String(kpis.swapsToday)}
          status={kpiStatus.swapsToday}
        />
        <KPIStatCard
          label="Batteries Ready"
          value={String(kpis.batteriesReady)}
          status={kpiStatus.batteriesReady}
        />
        <KPIStatCard
          label="Charging Active"
          value={String(kpis.chargingSessionsActive)}
          status={kpiStatus.chargingSessionsActive}
        />
        <KPIStatCard
          label="Corridor Energy Today (kWh/day)"
          value={Math.round(kpis.corridorEnergyToday).toLocaleString()}
          status={kpiStatus.corridorEnergyToday}
        />
        <KPIStatCard
          label="Corridor Revenue (ETB)"
          value={Math.round(kpis.corridorRevenueEtb).toLocaleString()}
          status={kpiStatus.corridorRevenueEtb}
        />
        <KPIStatCard
          label="A2 Share (ETB)"
          value={Math.round(kpis.a2ShareEtb).toLocaleString()}
          status={kpiStatus.a2ShareEtb}
        />
        <KPIStatCard
          label="EEU Share (ETB)"
          value={Math.round(kpis.eeuShareEtb).toLocaleString()}
          status={kpiStatus.eeuShareEtb}
        />
        <KPIStatCard
          label="VAT Collected (ETB)"
          value={Math.round(kpis.vatCollectedEtb).toLocaleString()}
          status={kpiStatus.vatCollectedEtb}
        />
        <KPIStatCard
          label="Stations Online"
          value={String(kpis.stationsOnline)}
          status={kpiStatus.stationsOnline}
        />
      </section>

      <details className="group rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-foreground-muted hover:text-foreground">
          KPI badge thresholds (reference)
        </summary>
        <pre className="mt-2 whitespace-pre-wrap text-[10px] text-foreground-muted">
          {KPI_THRESHOLDS_NOTE}
        </pre>
      </details>

      <article className="panel card-regular">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "batteries", label: "Batteries" },
            { id: "freight", label: "Freight" },
            { id: "system-health", label: "System Health" },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) =>
            setActiveTab(tabId as "overview" | "batteries" | "freight" | "system-health")
          }
        >
          <TabPanel id="overview" activeTab={activeTab}>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MapCardShell title="1) Real-time Network Map Panel">
            <OperationsCorridorMap
              stations={stationsQuery.data}
              trucks={trucksQuery.data}
              batteries={batteriesQuery.data}
            />
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

      <article className="panel card-regular">
        <p className="type-label">Driver / Truck Assignments (Live Sync)</p>
        <div className="mt-3 space-y-2">
          {driverTruckAssignments.length === 0 ? (
            <EmptyPlaceholder title="No active driver-truck assignments" />
          ) : (
            driverTruckAssignments.map((assignment) => (
              <div
                key={`${assignment.truckId}-${assignment.plateNumber}`}
                className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
              >
                <p className="text-sm font-semibold text-foreground">{assignment.plateNumber}</p>
                <p className="text-xs text-foreground-muted">{assignment.driverName}</p>
              </div>
            ))
          )}
        </div>
      </article>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <ChartCard title="3) Station Utilization Overview" subtitle={`${timeWindow} utilization`}>
          {a2ChartsQuery.data?.stationUtilization ? (
            <SimpleBarChart
              items={a2ChartsQuery.data.stationUtilization.map((s) => ({
                label: s.stationName,
                value: s.utilizationPct,
              }))}
              max={100}
              valueLabel={(v) => `${v}%`}
            />
          ) : null}
        </ChartCard>
        <ChartCard title="4) Battery Inventory Across Stations" subtitle="Ready/charging stock view">
          {a2ChartsQuery.data?.batteryInventory ? (
            <SimpleBarChart
              items={a2ChartsQuery.data.batteryInventory.map((s) => ({
                label: s.stationName,
                value: s.total,
              }))}
              valueLabel={(v) => String(v)}
            />
          ) : null}
        </ChartCard>
        <ChartCard title="5) Corridor Charging Activity" subtitle="Active sessions by station">
          {a2ChartsQuery.data?.chargingActivity ? (
            <SimpleBarChart
              items={a2ChartsQuery.data.chargingActivity.map((s) => ({
                label: s.stationName,
                value: s.activeSessions,
              }))}
            />
          ) : null}
        </ChartCard>
        <ChartCard title="6) Truck Movement Summary" subtitle="Corridor movement by status">
          {a2ChartsQuery.data?.truckMovement ? (
            <SimpleBarChart items={a2ChartsQuery.data.truckMovement} />
          ) : null}
        </ChartCard>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">7) Queue and Congestion Alerts</p>
          <div className="mt-3 space-y-2">
            {events.incidents.length === 0 ? (
              <EmptyPlaceholder
                title="No congestion alerts"
                description="Station queues are within normal range."
              />
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
              <EmptyPlaceholder
                title="No incidents reported"
                description="All systems operating normally."
              />
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
                  <th className="px-3 py-2">Energy (kWh/day)</th>
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
          </TabPanel>

          <TabPanel id="batteries" activeTab={activeTab}>
            <div className="mb-4 flex gap-3">
              <SearchInput
                placeholder="Search battery ID"
                value={batterySearchText}
                onChange={setBatterySearchText}
                className="flex-1"
              />
              <select
                value={batteryStatusFilter}
                onChange={(e) => setBatteryStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
              >
                <option value="ALL">All Status</option>
                <option value="READY">Ready</option>
                <option value="CHARGING">Charging</option>
                <option value="IN_TRUCK">In Truck</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <DataTableWrapper title="Battery Inventory" subtitle={`${filteredBatteries.length} batteries`}>
              <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2">Battery ID</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">SOC (%)</th>
                      <th className="px-3 py-2">Health (%)</th>
                      <th className="px-3 py-2">Cycle Count</th>
                      <th className="px-3 py-2">Location Type</th>
                      <th className="px-3 py-2">Location Name</th>
                      <th className="px-3 py-2">Temperature</th>
                      <th className="px-3 py-2">Capacity (kWh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatteries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-5">
                          <EmptyPlaceholder title="No batteries found" />
                        </td>
                      </tr>
                    ) : (
                      filteredBatteries.map((battery) => (
                        <tr key={battery.id} className="border-t border-border-subtle hover:bg-background-muted/40">
                          <td className="px-3 py-2 font-mono font-semibold text-foreground">
                            BAT-{String(battery.id).padStart(6, "0")}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              label={battery.status}
                              variant={
                                battery.status === "READY"
                                  ? "success"
                                  : battery.status === "CHARGING"
                                    ? "warning"
                                    : battery.status === "IN_TRUCK"
                                      ? "info"
                                      : "danger"
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.soc.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.health.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.cycleCount}</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.locationType}</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.locationName}</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.temperature.toFixed(1)}°C</td>
                          <td className="px-3 py-2 text-foreground-muted">{battery.capacityKwh.toFixed(1)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableWrapper>
          </TabPanel>

          <TabPanel id="freight" activeTab={activeTab}>
            <div className="mb-4 flex gap-3">
              <select
                value={freightStatusFilter}
                onChange={(e) => setFreightStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
              >
                <option value="ALL">All Status</option>
                <option value="REQUESTED">Requested</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            <DataTableWrapper title="Freight Orders" subtitle={`${filteredFreight.length} shipments`}>
              <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2">Shipment ID</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Pickup</th>
                      <th className="px-3 py-2">Delivery</th>
                      <th className="px-3 py-2">Cargo</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Truck</th>
                      <th className="px-3 py-2">Driver</th>
                      <th className="px-3 py-2">Refrigerated</th>
                      <th className="px-3 py-2">Assigned At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFreight.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-5">
                          <EmptyPlaceholder title="No freight orders found" />
                        </td>
                      </tr>
                    ) : (
                      filteredFreight.map((freight) => (
                        <tr key={freight.id} className="border-t border-border-subtle hover:bg-background-muted/40">
                          <td className="px-3 py-2 font-mono font-semibold text-foreground">
                            #{freight.id}
                          </td>
                          <td className="px-3 py-2 text-foreground-muted">
                            {freight.customerId ? `Customer #${freight.customerId}` : "N/A"}
                          </td>
                          <td className="px-3 py-2 text-foreground-muted text-xs">{freight.pickupLocation}</td>
                          <td className="px-3 py-2 text-foreground-muted text-xs">{freight.deliveryLocation}</td>
                          <td className="px-3 py-2 text-foreground-muted text-xs max-w-[200px] truncate">
                            {freight.cargoDescription}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              label={freight.status}
                              variant={
                                freight.status === "DELIVERED"
                                  ? "success"
                                  : freight.status === "IN_TRANSIT"
                                    ? "info"
                                    : freight.status === "ASSIGNED"
                                      ? "warning"
                                      : "neutral"
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-foreground-muted">{freight.assignedTruck}</td>
                          <td className="px-3 py-2 text-foreground-muted">{freight.assignedDriver}</td>
                          <td className="px-3 py-2">
                            {freight.requiresRefrigeration ? (
                              <StatusBadge label="Yes" variant="info" />
                            ) : (
                              <span className="text-foreground-muted">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-foreground-muted text-xs">
                            {freight.assignedAt
                              ? new Date(freight.assignedAt).toLocaleDateString()
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableWrapper>
          </TabPanel>

          <TabPanel id="system-health" activeTab={activeTab}>
            <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
              <KPIStatCard
                label="Stations Online"
                value={String(systemHealth.stationsOnline)}
                status="success"
              />
              <KPIStatCard
                label="Stations Offline"
                value={String(systemHealth.stationsOffline)}
                status={systemHealth.stationsOffline > 0 ? "danger" : "neutral"}
              />
              <KPIStatCard
                label="Trucks Active"
                value={String(systemHealth.trucksActive)}
                status="success"
              />
              <KPIStatCard
                label="Trucks Idle"
                value={String(systemHealth.trucksIdle)}
                status="neutral"
              />
              <KPIStatCard
                label="Trucks Maintenance"
                value={String(systemHealth.trucksMaintenance)}
                status={systemHealth.trucksMaintenance > 0 ? "warning" : "neutral"}
              />
              <KPIStatCard
                label="Drivers Active"
                value={String(systemHealth.driversActive)}
                status="success"
              />
              <KPIStatCard
                label="Drivers Inactive"
                value={String(systemHealth.driversInactive)}
                status="neutral"
              />
              <KPIStatCard
                label="Network Utilization (%)"
                value={String(systemHealth.networkUtilization)}
                status={systemHealth.networkUtilization > 80 ? "warning" : "info"}
              />
            </section>

            <section className="dashboard-grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <article className="panel card-regular">
                <p className="type-label">Alert Summary</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">Critical Alerts</p>
                    <p className="text-2xl font-semibold text-danger">{systemHealth.criticalAlerts}</p>
                  </div>
                  <div className="rounded-xl border border-warning/35 bg-warning/10 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">Warning Alerts</p>
                    <p className="text-2xl font-semibold text-warning">{systemHealth.warningAlerts}</p>
                  </div>
                </div>
              </article>

              <article className="panel card-regular">
                <p className="type-label">Performance Metrics</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
                    <p className="text-xs text-foreground-muted">Average Swap Time</p>
                    <p className="text-lg font-semibold text-foreground">
                      {systemHealth.averageSwapTime} minutes
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
                    <p className="text-xs text-foreground-muted">Average Charging Time</p>
                    <p className="text-lg font-semibold text-foreground">
                      {systemHealth.averageChargingTime} minutes
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <DataTableWrapper title="Station Health Grid" subtitle={`${stationsQuery.data?.length ?? 0} stations`}>
              <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2">Station Name</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Batteries Ready</th>
                      <th className="px-3 py-2">Charging</th>
                      <th className="px-3 py-2">Queue Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationsQuery.data?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-5">
                          <EmptyPlaceholder title="No stations found" />
                        </td>
                      </tr>
                    ) : (
                      stationsQuery.data?.map((station) => {
                        const stationBatteries = batteriesQuery.data?.filter(
                          (b) => b.stationId === station.id
                        ) ?? [];
                        const readyBatteries = stationBatteries.filter((b) => b.status === "READY").length;
                        const chargingBatteries = stationBatteries.filter((b) => b.status === "CHARGING").length;
                        const queueSize = 0; // Would come from station summary

                        return (
                          <tr key={station.id} className="border-t border-border-subtle hover:bg-background-muted/40">
                            <td className="px-3 py-2 font-semibold text-foreground">{station.name}</td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                label={station.status}
                                variant={station.status === "ACTIVE" ? "success" : "danger"}
                              />
                            </td>
                            <td className="px-3 py-2 text-foreground-muted">{readyBatteries}</td>
                            <td className="px-3 py-2 text-foreground-muted">{chargingBatteries}</td>
                            <td className="px-3 py-2 text-foreground-muted">{queueSize}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </DataTableWrapper>
          </TabPanel>
        </Tabs>
      </article>
    </div>
  );
}
