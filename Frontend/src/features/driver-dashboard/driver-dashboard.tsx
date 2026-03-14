"use client";

import { useMemo, useState } from "react";

import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableToolbar } from "@/components/ui/table-toolbar";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { queryKeys } from "@/constants/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useAppQuery } from "@/lib/query";
import { useSmartPolling } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";
import { dashboardService } from "@/services/dashboard.service";
import { driversService } from "@/services/drivers.service";
import { trucksService } from "@/services/trucks.service";
import type { Shipment } from "@/types/shipment";

import { DriverDashboardSkeleton } from "./driver-dashboard-skeleton";

function toKm(soc: number): number {
  return Math.max(0, Math.round(soc * 3.2));
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `~${h}h ${m}m`;
}

function getShipmentEta(shipment: Shipment): string {
  const pickedAt = shipment.pickupConfirmedAt ? Date.parse(shipment.pickupConfirmedAt) : NaN;
  if (!Number.isFinite(pickedAt)) {
    return "~4h 20m";
  }
  const etaMs = pickedAt + 4 * 60 * 60 * 1000;
  const diffMin = Math.max(0, Math.round((etaMs - Date.now()) / 60000));
  return formatDuration(diffMin);
}

export function DriverDashboard() {
  const { user } = useAuth();
  const [preferredDriverId, setPreferredDriverId] = useState<number>(1);
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);

  const driversQuery = appQueries.useDrivers();
  const stationsQuery = appQueries.useStations();
  const freightQuery = appQueries.useShipments();
  const batteriesQuery = appQueries.useBatteries();
  const swapsQuery = appQueries.useSwaps();

  const selectedDriverId = useMemo(() => {
    const drivers = driversQuery.data ?? [];
    if (!drivers.length) return preferredDriverId;

    const userMappedDriverId = Number(user?.organizationId);
    if (Number.isFinite(userMappedDriverId) && userMappedDriverId > 0) {
      const hasMapped = drivers.some((driver) => driver.id === userMappedDriverId);
      if (hasMapped) return userMappedDriverId;
    }

    const preferredExists = drivers.some((driver) => driver.id === preferredDriverId);
    return preferredExists ? preferredDriverId : drivers[0].id;
  }, [driversQuery.data, preferredDriverId, user?.organizationId]);

  const driverQuery = useAppQuery({
    queryKey: queryKeys.drivers.byId(selectedDriverId),
    queryFn: () => driversService.getById(selectedDriverId),
    enabled: Boolean(selectedDriverId),
  });

  const dashboardDriverQuery = useAppQuery({
    queryKey: queryKeys.dashboard.driver(selectedDriverId),
    queryFn: () => dashboardService.driver(selectedDriverId),
    enabled: Boolean(selectedDriverId),
    staleTime: 20_000,
  });

  const assignedTruckId = driverQuery.data?.assignedTruckId ?? null;
  const truckQuery = useAppQuery({
    queryKey: queryKeys.trucks.byId(assignedTruckId ?? -1),
    queryFn: async () => {
      if (!assignedTruckId) {
        throw new Error("No assigned truck");
      }
      return trucksService.getById(assignedTruckId);
    },
    enabled: Boolean(assignedTruckId),
  });

  const isLoading =
    driversQuery.isLoading ||
    stationsQuery.isLoading ||
    freightQuery.isLoading ||
    batteriesQuery.isLoading ||
    swapsQuery.isLoading ||
    driverQuery.isLoading ||
    dashboardDriverQuery.isLoading ||
    truckQuery.isLoading;

  const hasError =
    driversQuery.isError ||
    stationsQuery.isError ||
    freightQuery.isError ||
    batteriesQuery.isError ||
    swapsQuery.isError ||
    driverQuery.isError ||
    dashboardDriverQuery.isError ||
    (Boolean(assignedTruckId) && truckQuery.isError);

  const activeShipment = useMemo(() => {
    return (freightQuery.data ?? []).find(
      (shipment) =>
        shipment.driverId === selectedDriverId &&
        ["ASSIGNED", "IN_TRANSIT"].includes(shipment.status)
    );
  }, [freightQuery.data, selectedDriverId]);

  const nearestStations = useMemo(() => {
    const batteries = batteriesQuery.data ?? [];
    return (stationsQuery.data ?? [])
      .map((station) => {
        const readyBatteries = batteries.filter(
          (battery) => battery.stationId === station.id && battery.status === "READY"
        ).length;
        const queue = (station.id * 3 + selectedDriverId) % 7;
        const distanceKm = 8 + ((station.id * 11 + selectedDriverId) % 85);
        return {
          id: station.id,
          name: station.name,
          readyBatteries,
          queue,
          distanceKm,
          etaMin: Math.max(8, Math.round(distanceKm * 1.6)),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 4);
  }, [stationsQuery.data, batteriesQuery.data, selectedDriverId]);

  const nearestStation = nearestStations[0];
  const nextDestination = activeShipment?.deliveryLocation ?? "Awaiting assignment";

  const soc = truckQuery.data?.currentSoc ?? 0;
  const rangeKm = toKm(soc);
  const telemetryWarnings = [
    (driverQuery.data?.speedViolations ?? 0) > 0
      ? `${driverQuery.data?.speedViolations} speed violations`
      : null,
    (driverQuery.data?.harshBrakes ?? 0) > 0
      ? `${driverQuery.data?.harshBrakes} harsh brakes`
      : null,
  ].filter(Boolean) as string[];

  const swapHistory = useMemo(
    () =>
      (swapsQuery.data ?? [])
        .filter((swap) => (assignedTruckId ? swap.truckId === assignedTruckId : false))
        .slice(0, 8),
    [swapsQuery.data, assignedTruckId]
  );

  const activityLog = useMemo(() => {
    const payload = dashboardDriverQuery.data as Record<string, unknown> | undefined;
    const entries = payload?.recentActivity;
    if (Array.isArray(entries)) {
      return entries.slice(0, 8).map((item, index) => ({
        id: `a-${index}`,
        label:
          typeof item === "string"
            ? item
            : String((item as Record<string, unknown>).message ?? "Driver update"),
      }));
    }
    return swapHistory.slice(0, 5).map((swap) => ({
      id: `s-${swap.id}`,
      label: `Swap #${swap.id} at station ${swap.stationId}`,
    }));
  }, [dashboardDriverQuery.data, swapHistory]);

  const liveStatus = useSmartPolling({
    queries: [
      dashboardDriverQuery,
      driverQuery,
      swapsQuery,
      freightQuery,
      stationsQuery,
      batteriesQuery,
      ...(assignedTruckId ? [truckQuery] : []),
    ],
    enabled: liveUpdatesEnabled,
    intervalMs: 12_000,
  });

  async function onRefresh() {
    const refreshJobs: Array<Promise<unknown>> = [
      driversQuery.refetch(),
      driverQuery.refetch(),
      dashboardDriverQuery.refetch(),
      freightQuery.refetch(),
      stationsQuery.refetch(),
      batteriesQuery.refetch(),
      swapsQuery.refetch(),
    ];
    if (assignedTruckId) {
      refreshJobs.push(truckQuery.refetch());
    }
    await Promise.all(refreshJobs);
  }

  if (isLoading) return <DriverDashboardSkeleton />;

  if (hasError) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <ErrorState
          title="Unable to load driver dashboard"
          message="Please check network connectivity or driver assignment."
        />
        <AsyncActionButton label="Retry" onClick={onRefresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
      <PageHeader
        eyebrow="Driver Operations App"
        title={`Good day, ${driverQuery.data?.name ?? "Driver"}`}
        description="Mobile-friendly command view for trip, swap, and safety operations."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />

      <FilterBar>
        <select
          value={selectedDriverId}
          onChange={(event) => setPreferredDriverId(Number(event.target.value))}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          {(driversQuery.data ?? []).map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        <StatusBadge label={truckQuery.data?.plateNumber ?? "No Truck"} variant="info" />
        <LiveRefreshIndicator {...liveStatus} compact />
      </FilterBar>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">Current SOC</p>
          <p className="mt-2 text-3xl font-semibold text-danger">{soc}%</p>
        </article>
        <article className="panel card-regular">
          <p className="type-label">Remaining Range</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{rangeKm} km</p>
        </article>
        <article className="panel card-regular">
          <p className="type-label">Assigned Truck</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {truckQuery.data?.plateNumber ?? "Unassigned"}
          </p>
        </article>
        <article className="panel card-regular">
          <p className="type-label">Next Destination</p>
          <p className="mt-2 text-xl font-semibold text-foreground">{nextDestination}</p>
        </article>
        <article className="panel card-regular">
          <p className="type-label">Nearest Station</p>
          <p className="mt-2 text-xl font-semibold text-foreground">
            {nearestStation?.name ?? "N/A"}
          </p>
        </article>
        <article className="panel card-regular">
          <p className="type-label">Estimated Wait</p>
          <p className="mt-2 text-xl font-semibold text-warning">
            {nearestStation ? formatDuration(nearestStation.etaMin) : "N/A"}
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">1) My Truck Summary</p>
          <div className="mt-3 space-y-2 rounded-xl border border-border-subtle bg-background-muted p-3 text-sm">
            <p>Truck: {truckQuery.data?.plateNumber ?? "N/A"}</p>
            <p>Status: {truckQuery.data?.status ?? "N/A"}</p>
            <p>SOC: {soc}%</p>
            <p>Temperature: {truckQuery.data?.temperatureCurrent ?? "-"}°C</p>
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">2) Battery Level & Range</p>
          <div className="mt-3 rounded-xl border border-border-subtle bg-background-muted p-3">
            <p className="text-3xl font-semibold text-danger">{soc}%</p>
            <p className="mt-1 text-sm text-foreground-muted">{rangeKm} km remaining</p>
            <div className="mt-3 h-2 rounded-full bg-background">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.max(4, Math.min(100, soc))}%` }}
              />
            </div>
          </div>
        </article>
      </section>

      <article className="panel card-regular">
        <p className="type-label">3) Nearest Stations (Battery Availability)</p>
        <div className="mt-3 space-y-2">
          {nearestStations.length === 0 ? (
            <EmptyPlaceholder title="No nearby stations available" />
          ) : (
            nearestStations.map((station, index) => (
              <div
                key={station.id}
                className="rounded-xl border border-border-subtle bg-background-muted px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-semibold text-foreground">{station.name}</p>
                  {index === 0 ? <StatusBadge label="Recommended" variant="success" /> : null}
                </div>
                <p className="mt-1 text-sm text-foreground-muted">
                  {station.readyBatteries} batteries ready · {station.queue} in queue
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {station.distanceKm} km · {formatDuration(station.etaMin)}
                </p>
              </div>
            ))
          )}
        </div>
      </article>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">4) Trip Instructions</p>
          <div className="mt-3 space-y-2 text-sm text-foreground-muted">
            <p>1. Proceed toward next destination.</p>
            <p>2. Maintain speed and avoid harsh braking.</p>
            <p>3. Trigger swap workflow if SOC falls below 20%.</p>
            <p>4. Confirm pickup/delivery from assignment panel.</p>
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">5) Freight Assignment</p>
          {!activeShipment ? (
            <EmptyPlaceholder title="No active freight assignment" />
          ) : (
            <div className="mt-3 rounded-xl border border-border-subtle bg-background-muted p-3">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold text-foreground">FRT-{activeShipment.id}</p>
                <StatusBadge label={activeShipment.status} variant="info" />
              </div>
              <p className="mt-2 text-sm text-foreground-muted">
                Pickup: {activeShipment.pickupLocation}
              </p>
              <p className="text-sm text-foreground-muted">
                Delivery: {activeShipment.deliveryLocation}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                ETA {getShipmentEta(activeShipment)}
              </p>
            </div>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">6) Navigation / Route Map</p>
          <div className="mt-3 h-48 rounded-xl border border-border-subtle bg-[linear-gradient(180deg,#11213c,#0c162a)] p-3">
            <p className="text-sm text-foreground-muted">Map shell placeholder</p>
            <p className="mt-2 text-sm text-foreground">
              Current route: {nearestStation?.name ?? "Station"} → {nextDestination}
            </p>
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">7) Swap History</p>
          <div className="mt-3 space-y-2">
            {swapHistory.length === 0 ? (
              <EmptyPlaceholder title="No swap history for assigned truck" />
            ) : (
              swapHistory.map((swap) => (
                <div key={swap.id} className="rounded-lg border border-border-subtle px-3 py-2">
                  <p className="text-sm text-foreground">Swap #{swap.id}</p>
                  <p className="text-xs text-foreground-muted">
                    Station {swap.stationId} · {Math.round(swap.energyDeliveredKwh)} kWh
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">8) Driving Activity Log</p>
          <div className="mt-3 space-y-2">
            {activityLog.length === 0 ? (
              <EmptyPlaceholder title="No activity log entries" />
            ) : (
              activityLog.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border-subtle px-3 py-2">
                  <p className="text-sm text-foreground">{entry.label}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">9) Safety / Performance</p>
          <div className="mt-3 rounded-xl border border-border-subtle bg-background-muted p-3">
            <p className="text-3xl font-semibold text-foreground">
              {Math.round(driverQuery.data?.safetyScore ?? 0)}
            </p>
            <p className="mt-1 text-sm text-foreground-muted">Safety Score</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {telemetryWarnings.length === 0 ? (
                <StatusBadge label="No warnings" variant="success" />
              ) : (
                telemetryWarnings.map((warning) => (
                  <StatusBadge key={warning} label={warning} variant="warning" />
                ))
              )}
            </div>
          </div>
        </article>
      </section>

      {truckQuery.data?.truckType === "REFRIGERATED" ? (
        <article className="panel card-regular">
          <p className="type-label">10) Refrigeration Status</p>
          <TableToolbar
            left={<StatusBadge label="Refrigerated Truck" variant="info" />}
            right={<StatusBadge label="Cooling Active" variant="success" />}
          />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Target Temp</p>
              <p className="text-lg font-semibold text-foreground">
                {truckQuery.data.temperatureTarget}°C
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Current Temp</p>
              <p className="text-lg font-semibold text-foreground">
                {truckQuery.data.temperatureCurrent}°C
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs text-foreground-muted">Power Draw</p>
              <p className="text-lg font-semibold text-foreground">
                {truckQuery.data.refrigerationPowerDraw} kW
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 border-t border-border-subtle bg-background-elevated px-4 py-2 lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2 text-center text-xs text-foreground-muted">
          <button type="button" className="rounded-lg py-2 text-accent">
            Home
          </button>
          <button type="button" className="rounded-lg py-2">
            Swaps
          </button>
          <button type="button" className="rounded-lg py-2">
            Activity
          </button>
          <button type="button" className="rounded-lg py-2">
            Navigate
          </button>
        </div>
      </nav>
    </div>
  );
}
