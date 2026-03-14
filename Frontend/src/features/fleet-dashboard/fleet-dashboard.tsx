"use client";

import { useMemo, useState } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useSmartPolling } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";

import { FleetDashboardSkeleton } from "./fleet-dashboard-skeleton";
import { deriveFleetKpis, resolveFleetId } from "./normalize";

function currency(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function FleetDashboard() {
  const { user } = useAuth();
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const [preferredFleetId, setPreferredFleetId] = useState<number>(1);
  const [truckTypeFilter, setTruckTypeFilter] = useState("ALL");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);

  const fleetsQuery = appQueries.useFleets();
  const trucksQuery = appQueries.useTrucks();
  const driversQuery = appQueries.useDrivers();
  const swapsQuery = appQueries.useSwaps();
  const shipmentsQuery = appQueries.useShipments();
  const billingFleetsQuery = appQueries.useBillingSummaryFleets();

  const selectedFleetId = useMemo(
    () =>
      resolveFleetId({
        fleets: fleetsQuery.data ?? [],
        preferredFleetId,
        organizationId: user?.organizationId,
      }),
    [fleetsQuery.data, preferredFleetId, user?.organizationId]
  );

  const fleetSummaryQuery = appQueries.useFleetSummary(selectedFleetId);

  const isLoading =
    fleetsQuery.isLoading ||
    trucksQuery.isLoading ||
    driversQuery.isLoading ||
    swapsQuery.isLoading ||
    shipmentsQuery.isLoading ||
    billingFleetsQuery.isLoading ||
    fleetSummaryQuery.isLoading;
  const hasError =
    fleetsQuery.isError ||
    trucksQuery.isError ||
    driversQuery.isError ||
    swapsQuery.isError ||
    shipmentsQuery.isError ||
    billingFleetsQuery.isError ||
    fleetSummaryQuery.isError;

  const fleet = useMemo(
    () => (fleetsQuery.data ?? []).find((item) => item.id === selectedFleetId),
    [fleetsQuery.data, selectedFleetId]
  );
  const fleetTrucks = useMemo(
    () => (trucksQuery.data ?? []).filter((truck) => truck.fleetId === selectedFleetId),
    [trucksQuery.data, selectedFleetId]
  );
  const fleetDrivers = useMemo(
    () => (driversQuery.data ?? []).filter((driver) => driver.fleetId === selectedFleetId),
    [driversQuery.data, selectedFleetId]
  );

  const filteredTrucks = useMemo(
    () =>
      fleetTrucks.filter((truck) => {
        if (truckTypeFilter !== "ALL" && truck.truckType !== truckTypeFilter) return false;
        if (
          availabilityFilter !== "ALL" &&
          !((truck.availability || truck.status).toUpperCase().includes(availabilityFilter))
        ) {
          return false;
        }
        if (driverFilter !== "ALL" && String(truck.assignedDriverId ?? "") !== driverFilter) {
          return false;
        }
        if (
          searchText.trim() &&
          !truck.plateNumber.toLowerCase().includes(searchText.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [fleetTrucks, truckTypeFilter, availabilityFilter, driverFilter, searchText]
  );

  const kpis = useMemo(
    () =>
      deriveFleetKpis({
        trucks: fleetTrucks,
        drivers: fleetDrivers,
        swaps: swapsQuery.data ?? [],
        shipments: shipmentsQuery.data ?? [],
        billingSummaryFleets: billingFleetsQuery.data,
        selectedFleetId,
      }),
    [
      fleetTrucks,
      fleetDrivers,
      swapsQuery.data,
      shipmentsQuery.data,
      billingFleetsQuery.data,
      selectedFleetId,
    ]
  );

  const driverById = useMemo(() => {
    const map = new Map<number, (typeof fleetDrivers)[number]>();
    fleetDrivers.forEach((driver) => map.set(driver.id, driver));
    return map;
  }, [fleetDrivers]);

  const driverRanking = useMemo(
    () =>
      [...fleetDrivers].sort(
        (a, b) => (b.overallRating + b.safetyScore / 100) - (a.overallRating + a.safetyScore / 100)
      ),
    [fleetDrivers]
  );

  const swapsByTruck = useMemo(() => {
    const map = new Map<number, number>();
    for (const swap of swapsQuery.data ?? []) {
      if (!fleetTrucks.some((truck) => truck.id === swap.truckId)) continue;
      map.set(swap.truckId, (map.get(swap.truckId) ?? 0) + 1);
    }
    return map;
  }, [swapsQuery.data, fleetTrucks]);

  const truckEnergyByDay = useMemo(
    () =>
      filteredTrucks.map((truck) => {
        const base = Math.round((100 - truck.currentSoc) * 2.2);
        return { truckId: truck.id, plate: truck.plateNumber, kwhToday: Math.max(0, base) };
      }),
    [filteredTrucks]
  );

  const maintenanceRows = useMemo(
    () =>
      filteredTrucks
        .filter((truck) => truck.status.toUpperCase() === "MAINTENANCE" || truck.currentSoc < 20)
        .slice(0, 8),
    [filteredTrucks]
  );

  const refrigeratedRows = useMemo(
    () => filteredTrucks.filter((truck) => truck.truckType === "REFRIGERATED"),
    [filteredTrucks]
  );
  const selectedTruck = useMemo(
    () => filteredTrucks.find((truck) => truck.id === selectedTruckId) ?? null,
    [filteredTrucks, selectedTruckId]
  );

  const liveStatus = useSmartPolling({
    queries: [fleetSummaryQuery, swapsQuery, trucksQuery, driversQuery, shipmentsQuery],
    enabled: liveUpdatesEnabled,
    intervalMs: 12_000,
  });

  async function onRefresh() {
    await Promise.all([
      fleetsQuery.refetch(),
      trucksQuery.refetch(),
      driversQuery.refetch(),
      swapsQuery.refetch(),
      shipmentsQuery.refetch(),
      billingFleetsQuery.refetch(),
      fleetSummaryQuery.refetch(),
    ]);
  }

  if (isLoading) return <FleetDashboardSkeleton />;
  if (hasError) {
    return (
      <div className="dashboard-grid grid-cols-1">
        <ErrorState title="Unable to load fleet operations dashboard" />
        <AsyncActionButton label="Retry" onClick={onRefresh} className="w-fit" />
      </div>
    );
  }

  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="Fleet Portal"
        title={`${fleet?.name ?? "Fleet"} Overview`}
        description="Live status of trucks, drivers, maintenance, energy cost and assignment performance."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />

      <FilterBar>
        <select
          value={selectedFleetId}
          onChange={(event) => setPreferredFleetId(Number(event.target.value))}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          {(fleetsQuery.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <SearchInput
          placeholder="Search truck plate"
          value={searchText}
          onChange={setSearchText}
        />
        <select
          value={truckTypeFilter}
          onChange={(event) => setTruckTypeFilter(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="ALL">Truck Type: All</option>
          <option value="STANDARD">Standard</option>
          <option value="REFRIGERATED">Refrigerated</option>
        </select>
        <select
          value={driverFilter}
          onChange={(event) => setDriverFilter(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="ALL">Driver: All</option>
          {fleetDrivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>
              {driver.name}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(event) => setAvailabilityFilter(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="ALL">Availability: All</option>
          <option value="AVAILABLE">Available</option>
          <option value="ACTIVE">Active</option>
          <option value="IDLE">Idle</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
        <LiveRefreshIndicator {...liveStatus} />
      </FilterBar>

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard label="Active Trucks" value={String(kpis.activeTrucks)} status="info" />
        <KPIStatCard label="Available Trucks" value={String(kpis.availableTrucks)} status="success" />
        <KPIStatCard label="Active Drivers" value={String(kpis.activeDrivers)} status="success" />
        <KPIStatCard label="Swaps Today" value={String(kpis.swapsToday)} status="info" />
        <KPIStatCard
          label="Fleet Energy Cost"
          value={currency(kpis.fleetEnergyCostEtb)}
          status="warning"
        />
        <KPIStatCard label="Completed Trips" value={String(kpis.completedTrips)} status="neutral" />
        <KPIStatCard
          label="Maintenance Alerts"
          value={String(kpis.maintenanceAlerts)}
          status={kpis.maintenanceAlerts > 0 ? "danger" : "success"}
        />
        <KPIStatCard
          label="Refrigerated Active"
          value={String(kpis.refrigeratedTrucksActive)}
          status="info"
        />
      </section>

      <DataTableWrapper title="2) Truck Table with Live Status" subtitle="Click a truck row for details">
        <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
              <tr>
                <th className="px-3 py-2">Truck</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">SOC</th>
                <th className="px-3 py-2">Swaps</th>
                <th className="px-3 py-2">Energy Today</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-5">
                    <EmptyPlaceholder title="No trucks match filters" />
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((truck) => {
                  const driver = truck.assignedDriverId
                    ? driverById.get(truck.assignedDriverId)
                    : undefined;
                  const energy = truckEnergyByDay.find((item) => item.truckId === truck.id)?.kwhToday ?? 0;
                  return (
                    <tr
                      key={truck.id}
                      className="cursor-pointer border-t border-border-subtle hover:bg-background-muted/40"
                      onClick={() => setSelectedTruckId(truck.id)}
                    >
                      <td className="px-3 py-2 font-semibold text-foreground">{truck.plateNumber}</td>
                      <td className="px-3 py-2 text-foreground-muted">{driver?.name ?? "Unassigned"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={truck.status}
                          variant={
                            truck.status.toUpperCase() === "MAINTENANCE"
                              ? "danger"
                              : truck.status.toUpperCase() === "IDLE"
                                ? "neutral"
                                : "success"
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={truck.truckType}
                          variant={truck.truckType === "REFRIGERATED" ? "info" : "neutral"}
                        />
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{truck.currentSoc}%</td>
                      <td className="px-3 py-2 text-foreground-muted">{swapsByTruck.get(truck.id) ?? 0}</td>
                      <td className="px-3 py-2 text-foreground-muted">{energy} kWh</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DataTableWrapper>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">3) Driver Assignments</p>
          <div className="mt-3 space-y-2">
            {fleetDrivers.length === 0 ? (
              <EmptyPlaceholder title="No drivers in fleet" />
            ) : (
              fleetDrivers.map((driver) => (
                <div key={driver.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{driver.name}</p>
                    <StatusBadge
                      label={driver.status}
                      variant={driver.status.toUpperCase() === "ACTIVE" ? "success" : "neutral"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Truck:{" "}
                    {driver.assignedTruckId
                      ? fleetTrucks.find((truck) => truck.id === driver.assignedTruckId)?.plateNumber ?? "Assigned"
                      : "Unassigned"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">4) Energy Usage by Truck</p>
          <ChartCard title="kWh Today by Truck" subtitle="Live truck-level estimate" />
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">5) Swap Activity by Truck</p>
          <div className="mt-3 space-y-2">
            {filteredTrucks.slice(0, 8).map((truck) => (
              <div key={truck.id} className="rounded-lg border border-border-subtle px-3 py-2">
                <p className="text-sm text-foreground">{truck.plateNumber}</p>
                <p className="text-xs text-foreground-muted">
                  {swapsByTruck.get(truck.id) ?? 0} swaps today
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">6) Trips Completed</p>
          <div className="mt-3 rounded-xl border border-border-subtle bg-background-muted px-3 py-3">
            <p className="text-3xl font-semibold text-foreground">{kpis.completedTrips}</p>
            <p className="mt-1 text-sm text-foreground-muted">Delivered shipments for this fleet</p>
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">7) Truck Utilization Panel</p>
          <div className="mt-3 space-y-2">
            {filteredTrucks.slice(0, 7).map((truck) => (
              <div key={truck.id}>
                <div className="mb-1 flex justify-between text-xs text-foreground-muted">
                  <span>{truck.plateNumber}</span>
                  <span>{truck.currentSoc}%</span>
                </div>
                <div className="h-2 rounded-full bg-background-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.max(5, Math.min(100, truck.currentSoc))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">8) Maintenance Alerts</p>
          <div className="mt-3 space-y-2">
            {maintenanceRows.length === 0 ? (
              <EmptyPlaceholder title="No maintenance alerts" />
            ) : (
              maintenanceRows.map((truck) => (
                <div key={truck.id} className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{truck.plateNumber}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {truck.status.toUpperCase() === "MAINTENANCE"
                      ? "Under maintenance"
                      : `Low SOC alert (${truck.currentSoc}%)`}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">9) Driver Performance Ranking</p>
          <div className="mt-3 space-y-2">
            {driverRanking.slice(0, 8).map((driver, index) => (
              <div key={driver.id} className="rounded-xl border border-border-subtle px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    #{index + 1} {driver.name}
                  </p>
                  <StatusBadge label={`${driver.overallRating.toFixed(1)}★`} variant="info" />
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  Safety {Math.round(driver.safetyScore)} · Violations {driver.speedViolations}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">10) Refrigerated Truck Analytics</p>
          <div className="mt-3 space-y-2">
            {refrigeratedRows.length === 0 ? (
              <EmptyPlaceholder title="No refrigerated trucks active" />
            ) : (
              refrigeratedRows.map((truck) => (
                <div key={truck.id} className="rounded-xl border border-info/30 bg-info/10 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{truck.plateNumber}</p>
                    <StatusBadge label="REFRIGERATED" variant="info" />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Temp {truck.temperatureCurrent}°C / Target {truck.temperatureTarget}°C
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <article className="panel card-regular">
        <p className="type-label">11) Fleet Billing Summary</p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
            <p className="text-xs text-foreground-muted">Energy Cost</p>
            <p className="text-lg font-semibold text-foreground">{currency(kpis.fleetEnergyCostEtb)}</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
            <p className="text-xs text-foreground-muted">Swaps Today</p>
            <p className="text-lg font-semibold text-foreground">{kpis.swapsToday}</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
            <p className="text-xs text-foreground-muted">Completed Trips</p>
            <p className="text-lg font-semibold text-foreground">{kpis.completedTrips}</p>
          </div>
        </div>
      </article>

      <DetailDrawer
        open={Boolean(selectedTruck)}
        title={selectedTruck?.plateNumber ?? "Truck detail"}
        onClose={() => setSelectedTruckId(null)}
      >
        {selectedTruck ? (
          <>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Status</p>
              <p className="font-semibold text-foreground">{selectedTruck.status}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Availability</p>
              <p className="font-semibold text-foreground">{selectedTruck.availability || "N/A"}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">SOC</p>
              <p className="font-semibold text-foreground">{selectedTruck.currentSoc}%</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Truck Type</p>
              <p className="font-semibold text-foreground">{selectedTruck.truckType}</p>
            </div>
          </>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
