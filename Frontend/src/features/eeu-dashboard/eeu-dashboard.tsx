"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
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
import { EeuPaymentNotifications } from "./components/eeu-payment-notifications";
import { deriveEeuKpiStatus } from "./eeu-kpi-thresholds";
import {
  deriveEeuKpis,
  deriveGridNotices,
  deriveStationPowerRows,
} from "./normalize";

function formatEtb(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function EeuDashboard() {
  const [timeframe, setTimeframe] = useState<"daily" | "monthly" | "yearly">("daily");
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const stationsQuery = appQueries.useStations();
  const trucksQuery = appQueries.useTrucks();
  const batteriesQuery = appQueries.useBatteries();
  const eeuDashboardQuery = useAppQuery({
    queryKey: queryKeys.dashboard.eeu(timeframe),
    queryFn: () => dashboardService.eeu(timeframe),
    staleTime: 20_000,
  });

  const billingEeuQuery = appQueries.useBillingSummaryEeu(timeframe);
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
    batteriesQuery.isLoading ||
    eeuDashboardQuery.isLoading ||
    billingEeuQuery.isLoading ||
    tariffQuery.isLoading ||
    networkChargingQuery.isLoading;

  const hasError =
    stationsQuery.isError ||
    trucksQuery.isError ||
    batteriesQuery.isError ||
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

  const kpiStatus = useMemo(() => deriveEeuKpiStatus(kpis), [kpis]);

  const notices = useMemo(
    () => deriveGridNotices({ stationRows, tariffConfig: tariffQuery.data }),
    [stationRows, tariffQuery.data]
  );

  const liveStatus = useSmartPolling({
    queries: [
      eeuDashboardQuery,
      networkChargingQuery,
      billingEeuQuery,
      stationsQuery,
      trucksQuery,
      batteriesQuery,
    ],
    enabled: liveUpdatesEnabled,
    intervalMs: 10_000,
  });

  useWebSocketLive({
    url: process.env.NEXT_PUBLIC_LIVE_WS_URL ?? null,
    enabled: liveUpdatesEnabled && Boolean(process.env.NEXT_PUBLIC_LIVE_WS_URL),
    onMessage: () => {
      void networkChargingQuery.refetch();
      void eeuDashboardQuery.refetch();
      void trucksQuery.refetch();
      void batteriesQuery.refetch();
    },
  });

  async function onRefresh() {
    await Promise.all([
      stationsQuery.refetch(),
      trucksQuery.refetch(),
      batteriesQuery.refetch(),
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
      <EeuPaymentNotifications billingSummaryEeu={billingEeuQuery.data} />
      <PageHeader
        eyebrow="EEU Grid Control"
        title="Electricity Supply / A2 Corridor Load"
        description="Real-time monitoring for demand, load profile, station draw, charging utilization, and EEU revenue."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />
      <LiveRefreshIndicator {...liveStatus} />

      <div className="flex items-center justify-end gap-3">
        <label className="text-sm font-medium text-foreground">Timeframe:</label>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as "daily" | "monthly" | "yearly")}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard
          label="Total Network Load (kW, live)"
          value={kpis.totalNetworkLoadKw.toLocaleString()}
          status={kpiStatus.totalNetworkLoadKw}
        />
        <KPIStatCard
          label={`Station Energy, kWh (${timeframe})`}
          value={kpis.totalStationEnergyTodayKwh.toLocaleString()}
          status={kpiStatus.totalStationEnergyTodayKwh}
        />
        <KPIStatCard
          label={`Electricity Delivered, ETB (${timeframe})`}
          value={Math.round(kpis.electricityDeliveredEtb).toLocaleString()}
          status={kpiStatus.electricityDeliveredEtb}
        />
        <KPIStatCard
          label={`EEU Revenue Share, ETB (${timeframe})`}
          value={Math.round(kpis.eeuRevenueShareEtb).toLocaleString()}
          status={kpiStatus.eeuRevenueShareEtb}
        />
        <KPIStatCard
          label="Active Charging Sessions"
          value={String(kpis.activeChargingSessions)}
          status={kpiStatus.activeChargingSessions}
        />
        <KPIStatCard label="Peak Load Station" value={kpis.peakLoadStation} status={kpiStatus.peakLoadStation} />
        <KPIStatCard
          label="Forecast Load, kW (24h)"
          value={kpis.forecastLoadNext24HoursKw.toLocaleString()}
          status={kpiStatus.forecastLoadNext24HoursKw}
        />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-[280px_1fr_320px]">
        <article className="panel card-regular space-y-4">
          <p className="type-label">7) Power Interruptions / Notices</p>
          {notices.length === 0 ? (
            <EmptyPlaceholder
              title="No grid notices"
              description="No alerts or tariff updates at this time."
            />
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
              <OperationsCorridorMap
                stations={stationsQuery.data}
                trucks={trucksQuery.data}
                batteries={batteriesQuery.data}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatusBadge
                label={`Grid Capacity ${eeuDashboardQuery.data?.capacityUtilizationPct ?? 0}%`}
                variant={
                  (eeuDashboardQuery.data?.capacityUtilizationPct ?? 0) >= 85
                    ? "danger"
                    : (eeuDashboardQuery.data?.capacityUtilizationPct ?? 0) >= 65
                      ? "warning"
                      : "info"
                }
              />
              <StatusBadge label="Peak Threshold monitored" variant="warning" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard title="4) Grid Capacity Utilization" subtitle="Current load vs capacity">
              {eeuDashboardQuery.data?.capacityUtilizationPct != null ? (
                <SimpleBarChart
                  items={[
                    {
                      label: "Capacity used",
                      value: eeuDashboardQuery.data.capacityUtilizationPct,
                    },
                  ]}
                  max={100}
                  valueLabel={(v) => `${v}%`}
                />
              ) : null}
            </ChartCard>
            <ChartCard title="5) 24-hour Load Forecast" subtitle="Forecast next 24 hours">
              {eeuDashboardQuery.data?.forecast24h?.length ? (
                <SimpleBarChart
                  items={eeuDashboardQuery.data.forecast24h.map((h) => ({
                    label: `${h.hour}:00`,
                    value: h.forecastLoadKw,
                  }))}
                  valueLabel={(v) => `${v} kW`}
                />
              ) : null}
            </ChartCard>
          </div>
        </article>

        <article className="panel card-regular space-y-4">
          <p className="type-label">2) Electricity Demand by Station (Today)</p>
          <div className="space-y-2">
            {stationRows.slice(0, 10).map((row) => (
              <div key={row.stationId} className="rounded-xl border border-border-subtle px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{row.stationName}</p>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-info">{row.liveLoadKw} kW</p>
                    <p className="text-xs text-foreground-muted">(current)</p>
                  </div>
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

          <p className="type-label">3) Charger Power Draw Panel (Now)</p>
          <div className="space-y-2">
            {stationRows.slice(0, 10).map((row) => (
              <div key={`charger-${row.stationId}`} className="flex items-center justify-between rounded-xl border border-border-subtle px-3 py-2 text-sm">
                <span className="text-foreground-muted">{row.stationName}</span>
                <span className="text-foreground">{row.activeChargers} active</span>
              </div>
            ))}
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
                  <th className="px-3 py-2">Live Load (kW, current)</th>
                  <th className="px-3 py-2">Energy ({timeframe === "daily" ? "kWh/day" : timeframe === "monthly" ? "kWh/month" : "kWh/year"})</th>
                  <th className="px-3 py-2">Active Chargers</th>
                  <th className="px-3 py-2">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {stationRows.map((row) => (
                  <tr key={row.stationId} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-foreground">{row.stationName}</td>
                    <td className="px-3 py-2 text-foreground-muted">{row.liveLoadKw} kW</td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {row.energyTodayKwh} {timeframe === "daily" ? "kWh/day" : timeframe === "monthly" ? "kWh/month" : "kWh/year"}
                    </td>
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
          <p className="type-label">9) EEU Finance Summary ({timeframe})</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Total Energy Delivered</p>
              <p className="text-lg font-semibold text-foreground">
                {Math.round(billingEeuQuery.data?.totalEnergyKwh ?? 0).toLocaleString()} kWh
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">EEU Revenue Share</p>
              <p className="text-lg font-semibold text-success">
                {formatEtb(billingEeuQuery.data?.totalEeuShareEtb ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">VAT Share</p>
              <p className="text-lg font-semibold text-info">
                {formatEtb(billingEeuQuery.data?.totalVatEtb ? billingEeuQuery.data.totalVatEtb / 2 : 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Total Transactions</p>
              <p className="text-lg font-semibold text-foreground">
                {billingEeuQuery.data?.totalReceipts ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Avg Energy per Transaction</p>
              <p className="text-lg font-semibold text-foreground">
                {billingEeuQuery.data?.averageEnergyPerTransaction
                  ? Math.round(billingEeuQuery.data.averageEnergyPerTransaction).toLocaleString()
                  : 0}{" "}
                kWh
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
