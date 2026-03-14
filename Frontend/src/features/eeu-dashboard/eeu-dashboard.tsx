"use client";

import { useMemo } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { queryKeys } from "@/constants/query-keys";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useAppQuery } from "@/lib/query";
import { useSmartPolling, useWebSocketLive } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";
import { chargingService } from "@/services/charging.service";
import { dashboardService } from "@/services/dashboard.service";

import { EeuDashboardSkeleton } from "./eeu-dashboard-skeleton";
import {
  deriveEeuKpis,
  deriveGridNotices,
  deriveRefrigeratedImpact,
  deriveStationPowerRows,
} from "./normalize";

function formatEtb(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function EeuDashboard() {
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const stationsQuery = appQueries.useStations();
  const trucksQuery = appQueries.useTrucks();
  const eeuDashboardQuery = useAppQuery({
    queryKey: queryKeys.dashboard.eeu,
    queryFn: dashboardService.eeu,
    staleTime: 20_000,
  });

  const billingEeuQuery = appQueries.useBillingSummaryEeu();
  const tariffQuery = appQueries.useTariffConfig();

  const stationIds = useMemo(
    () => (stationsQuery.data ?? []).map((station) => station.id).sort((a, b) => a - b),
    [stationsQuery.data]
  );

  const networkChargingQuery = useAppQuery({
    queryKey: queryKeys.charging.network(stationIds),
    queryFn: async () => {
      const ids = stationIds;
      const payload = await Promise.all(
        ids.map(async (stationId) => ({
          stationId,
          sessions: await chargingService.listByStation(stationId),
        }))
      );
      return payload;
    },
    enabled: stationIds.length > 0,
    staleTime: 15_000,
  });

  const isLoading =
    stationsQuery.isLoading ||
    trucksQuery.isLoading ||
    eeuDashboardQuery.isLoading ||
    billingEeuQuery.isLoading ||
    tariffQuery.isLoading ||
    networkChargingQuery.isLoading;

  const hasError =
    stationsQuery.isError ||
    trucksQuery.isError ||
    eeuDashboardQuery.isError ||
    billingEeuQuery.isError ||
    networkChargingQuery.isError;

  const chargingSessionsByStation = useMemo(() => {
    const map: Record<number, number> = {};
    for (const row of networkChargingQuery.data ?? []) {
      map[row.stationId] = row.sessions.length;
    }
    return map;
  }, [networkChargingQuery.data]);

  const stationRows = useMemo(
    () =>
      deriveStationPowerRows({
        stations: stationsQuery.data ?? [],
        eeuSummary: eeuDashboardQuery.data,
        chargingSessionsByStation,
      }),
    [stationsQuery.data, eeuDashboardQuery.data, chargingSessionsByStation]
  );

  const activeChargingSessions = useMemo(
    () => Object.values(chargingSessionsByStation).reduce((sum, value) => sum + value, 0),
    [chargingSessionsByStation]
  );

  const kpis = useMemo(
    () =>
      deriveEeuKpis({
        eeuSummary: eeuDashboardQuery.data,
        billingSummaryEeu: billingEeuQuery.data,
        stationRows,
        activeChargingSessions,
      }),
    [eeuDashboardQuery.data, billingEeuQuery.data, stationRows, activeChargingSessions]
  );

  const notices = useMemo(
    () => deriveGridNotices({ stationRows, tariffConfig: tariffQuery.data }),
    [stationRows, tariffQuery.data]
  );

  const refrigeratedImpact = useMemo(
    () => deriveRefrigeratedImpact(trucksQuery.data ?? []),
    [trucksQuery.data]
  );

  const liveStatus = useSmartPolling({
    queries: [eeuDashboardQuery, networkChargingQuery, billingEeuQuery, stationsQuery],
    enabled: liveUpdatesEnabled,
    intervalMs: 10_000,
  });

  useWebSocketLive({
    url: process.env.NEXT_PUBLIC_LIVE_WS_URL ?? null,
    enabled: liveUpdatesEnabled && Boolean(process.env.NEXT_PUBLIC_LIVE_WS_URL),
    onMessage: () => {
      void networkChargingQuery.refetch();
      void eeuDashboardQuery.refetch();
    },
  });

  async function onRefresh() {
    await Promise.all([
      stationsQuery.refetch(),
      trucksQuery.refetch(),
      eeuDashboardQuery.refetch(),
      billingEeuQuery.refetch(),
      tariffQuery.refetch(),
      networkChargingQuery.refetch(),
    ]);
  }

  if (isLoading) return <EeuDashboardSkeleton />;

  if (hasError) {
    return (
      <div className="dashboard-grid grid-cols-1">
        <ErrorState title="Unable to load EEU dashboard" />
        <AsyncActionButton label="Retry" onClick={onRefresh} className="w-fit" />
      </div>
    );
  }

  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="EEU Grid Control"
        title="Electricity Supply / A2 Corridor Load"
        description="Real-time monitoring for demand, load profile, station draw, charging utilization, and EEU revenue."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />
      <LiveRefreshIndicator {...liveStatus} />

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard label="Total Network Load" value={`${kpis.totalNetworkLoadKw} kW`} status="info" />
        <KPIStatCard
          label="Station Energy Today"
          value={`${kpis.totalStationEnergyTodayKwh} kWh`}
          status="success"
        />
        <KPIStatCard
          label="Electricity Delivered"
          value={formatEtb(kpis.electricityDeliveredEtb)}
          status="warning"
        />
        <KPIStatCard
          label="EEU Revenue Share"
          value={formatEtb(kpis.eeuRevenueShareEtb)}
          status="success"
        />
        <KPIStatCard
          label="Active Charging Sessions"
          value={String(kpis.activeChargingSessions)}
          status="info"
        />
        <KPIStatCard label="Peak Load Station" value={kpis.peakLoadStation} status="danger" />
        <KPIStatCard
          label="Forecast Load (24h)"
          value={`${kpis.forecastLoadNext24HoursKw} kW`}
          status="warning"
        />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-[280px_1fr_320px]">
        <article className="panel card-regular space-y-4">
          <p className="type-label">7) Power Interruptions / Notices</p>
          {notices.length === 0 ? (
            <EmptyPlaceholder title="No grid notices" />
          ) : (
            notices.map((notice) => (
              <div key={notice.id} className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{notice.title}</p>
                  <StatusBadge label={notice.severity} variant={notice.severity} />
                </div>
                <p className="mt-1 text-xs text-foreground-muted">{notice.detail}</p>
              </div>
            ))
          )}
        </article>

        <article className="panel card-regular">
          <p className="type-label">1) Real-time Network Load Overview</p>
          <div className="mt-3 h-[420px] rounded-xl border border-border-subtle bg-[linear-gradient(180deg,#0a162b,#071222)] p-3">
            <div className="mb-3 flex items-center justify-between text-xs text-foreground-muted">
              <span>Current: {kpis.totalNetworkLoadKw} kW</span>
              <span>Auto-refresh 15s</span>
            </div>
            <div className="h-[320px] rounded-lg border border-border-subtle p-2">
              <svg viewBox="0 0 1000 260" className="h-full w-full">
                <defs>
                  <linearGradient id="loadStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00e1ff" />
                    <stop offset="100%" stopColor="#1f8dff" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,140 C80,120 130,160 210,130 C290,100 340,170 420,135 C500,95 560,165 640,130 C720,110 780,155 860,125 C920,105 970,120 1000,140"
                  fill="none"
                  stroke="url(#loadStroke)"
                  strokeWidth="3"
                />
                <line x1="0" y1="90" x2="1000" y2="90" stroke="#f59e0b" strokeDasharray="6 8" />
              </svg>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatusBadge label="Grid Capacity 64%" variant="info" />
              <StatusBadge label="Peak Threshold monitored" variant="warning" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="4) Grid Capacity Utilization" subtitle="Capacity used by hour" />
            <ChartCard title="5) 24-hour Load Forecast" subtitle="Forecast next 24 hours" />
          </div>
        </article>

        <article className="panel card-regular space-y-4">
          <p className="type-label">2) Electricity Demand by Station</p>
          <div className="space-y-2">
            {stationRows.slice(0, 10).map((row) => (
              <div key={row.stationId} className="rounded-xl border border-border-subtle px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{row.stationName}</p>
                  <p className="text-sm font-semibold text-info">{row.liveLoadKw} kW</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-background-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.max(5, Math.min(100, row.utilizationPct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="type-label">3) Charger Power Draw Panel</p>
          <div className="space-y-2">
            {stationRows.slice(0, 6).map((row) => (
              <div key={`charger-${row.stationId}`} className="flex items-center justify-between rounded-xl border border-border-subtle px-3 py-2 text-sm">
                <span className="text-foreground-muted">{row.stationName}</span>
                <span className="text-foreground">{row.activeChargers} active</span>
              </div>
            ))}
          </div>

          <p className="type-label">8) Refrigerated Fleet Energy Impact</p>
          <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-3">
            <p className="text-sm text-foreground">
              Active refrigerated trucks:{" "}
              <strong>{refrigeratedImpact.activeRefrigerated}</strong>
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              Estimated refrigeration draw: {refrigeratedImpact.estimatedDrawKw} kW
            </p>
          </div>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <DataTableWrapper title="6) Station-level Power Table" className="xl:col-span-2">
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-3 py-2">Station</th>
                  <th className="px-3 py-2">Live Load</th>
                  <th className="px-3 py-2">Energy Today</th>
                  <th className="px-3 py-2">Active Chargers</th>
                  <th className="px-3 py-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {stationRows.map((row) => (
                  <tr key={row.stationId} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-foreground">{row.stationName}</td>
                    <td className="px-3 py-2 text-foreground-muted">{row.liveLoadKw} kW</td>
                    <td className="px-3 py-2 text-foreground-muted">{row.energyTodayKwh} kWh</td>
                    <td className="px-3 py-2 text-foreground-muted">{row.activeChargers}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={`${row.utilizationPct}%`}
                        variant={row.utilizationPct > 85 ? "danger" : row.utilizationPct > 65 ? "warning" : "success"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataTableWrapper>

        <article className="panel card-regular">
          <p className="type-label">9) EEU Finance Summary</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Electricity Delivered</p>
              <p className="text-lg font-semibold text-foreground">
                {formatEtb(kpis.electricityDeliveredEtb)}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">EEU Revenue Share</p>
              <p className="text-lg font-semibold text-success">
                {formatEtb(kpis.eeuRevenueShareEtb)}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Current Tariff</p>
              <p className="text-lg font-semibold text-warning">
                {Number(tariffQuery.data?.eeuRatePerKwh ?? 0).toFixed(2)} ETB / kWh
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
