"use client";

import { useMemo, useState, useRef, useEffect } from "react";

import { ChartCard } from "@/components/dashboard/chart-card";
import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
import { SimpleBarChart } from "@/components/dashboard/simple-bar-chart";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Station } from "@/types/station";
import type { Truck } from "@/types/truck";
import { useAuth } from "@/hooks/use-auth";
import { appQueries } from "@/hooks/queries/use-app-data";
import { usePagination } from "@/hooks/use-pagination";
import { useSmartPolling } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";
import { useAppMutation } from "@/lib/query";
import { fleetsService } from "@/services/fleets.service";
import { useNotificationStore } from "@/store/notification-store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/query-keys";
import { dashboardService } from "@/services/dashboard.service";

import { Tabs, TabPanel } from "@/components/ui/tabs";
import { FleetDashboardSkeleton } from "./fleet-dashboard-skeleton";
import { deriveFleetKpiStatus } from "./fleet-kpi-thresholds";
import { deriveFleetKpis, resolveFleetId } from "./normalize";

function currency(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function FleetDashboard() {
  const { user, role } = useAuth();
  // FLEET_OWNER users are locked to their own fleet (organizationId = fleetId)
  const isFleetLocked = role === "FLEET_OWNER";
  const queryClient = useQueryClient();
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const notifySuccess = useNotificationStore((state) => state.success);
  const notifyError = useNotificationStore((state) => state.error);
  const [preferredFleetId, setPreferredFleetId] = useState<number>(1);
  const [truckTypeFilter, setTruckTypeFilter] = useState("ALL");
  const [driverFilter, setDriverFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);
  const [selectedTruckForAssignment, setSelectedTruckForAssignment] = useState<number | null>(null);
  const [recentAssignments, setRecentAssignments] = useState<Set<number>>(new Set());
  const previousAssignmentsRef = useRef<Map<number, number | null>>(new Map());
  const [activeTab, setActiveTab] = useState<"trucks" | "drivers">("trucks");

  const fleetsQuery = appQueries.useFleets();
  const trucksQuery = appQueries.useTrucks();
  const driversQuery = appQueries.useDrivers();
  const swapsQuery = appQueries.useSwaps();
  const shipmentsQuery = appQueries.useShipments();
  const batteriesQuery = appQueries.useBatteries();
  const billingFleetsQuery = appQueries.useBillingSummaryFleets();
  const stationsQuery = appQueries.useStations();

  const selectedFleetId = useMemo(
    () =>
      resolveFleetId({
        fleets: fleetsQuery.data ?? [],
        preferredFleetId,
        organizationId: user?.organizationId,
      }),
    [fleetsQuery.data, preferredFleetId, user?.organizationId]
  );

  const fleetSummaryQuery = appQueries.useFleetSummary(
    selectedFleetId > 0 ? selectedFleetId : 0
  );
  const fleetEnergyByTruckQuery = appQueries.useFleetEnergyByTruck(
    selectedFleetId > 0 ? selectedFleetId : 0
  );

  const isLoading =
    fleetsQuery.isLoading ||
    stationsQuery.isLoading ||
    trucksQuery.isLoading ||
    batteriesQuery.isLoading ||
    driversQuery.isLoading ||
    swapsQuery.isLoading ||
    shipmentsQuery.isLoading ||
    billingFleetsQuery.isLoading ||
    fleetSummaryQuery.isLoading;
  const hasError =
    fleetsQuery.isError ||
    stationsQuery.isError ||
    trucksQuery.isError ||
    batteriesQuery.isError ||
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

  const kpiStatus = useMemo(() => deriveFleetKpiStatus(kpis), [kpis]);

  const trucksPagination = usePagination(filteredTrucks, 15);
  const driversPagination = usePagination(fleetDrivers, 15);

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

  const lastSwapByTruck = useMemo(() => {
    const map = new Map<number, { stationId: number; timestamp: string }>();
    const sortedSwaps = [...(swapsQuery.data ?? [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    for (const swap of sortedSwaps) {
      if (!fleetTrucks.some((truck) => truck.id === swap.truckId)) continue;
      if (!map.has(swap.truckId)) {
        map.set(swap.truckId, { stationId: swap.stationId, timestamp: swap.timestamp });
      }
    }
    return map;
  }, [swapsQuery.data, fleetTrucks]);

  const stationById = useMemo(() => {
    const map = new Map<number, Station>();
    (stationsQuery.data ?? []).forEach((station) => {
      map.set(station.id, station);
    });
    return map;
  }, [stationsQuery.data]);

  function getTruckLocation(truck: Truck): string {
    if (truck.currentStationId !== null) {
      const station = stationById.get(truck.currentStationId);
      if (station) return station.name;
    }
    if (truck.locationLat !== null && truck.locationLng !== null) {
      return `${truck.locationLat.toFixed(4)}, ${truck.locationLng.toFixed(4)}`;
    }
    return "Unknown";
  }

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

  const assignDriverMutation = useAppMutation(
    (payload: { driverId: number; truckId: number }) =>
      fleetsService.assignDriver(selectedFleetId, payload)
  );

  const availableTrucksForAssignment = useMemo(() => {
    return fleetTrucks.filter(
      (truck) =>
        truck.status === "READY" &&
        (truck.assignedDriverId === null || truck.assignedDriverId === 0) &&
        truck.availability === "AVAILABLE"
    );
  }, [fleetTrucks]);

  async function handleAssignDriver(driverId: number, truckId: number | null) {
    if (!truckId) {
      notifyError("Please select a truck");
      return;
    }
    try {
      await assignDriverMutation.mutateAsync({ driverId, truckId });
      const truckPlate = fleetTrucks.find((t) => t.id === truckId)?.plateNumber ?? truckId;
      notifySuccess(`Driver assigned to truck ${truckPlate}`);
      setRecentAssignments((prev) => new Set([...prev, driverId]));
      setTimeout(() => {
        setRecentAssignments((prev) => {
          const next = new Set(prev);
          next.delete(driverId);
          return next;
        });
      }, 5000);
      setAssigningDriverId(null);
      setSelectedTruckForAssignment(null);
      await Promise.all([driversQuery.refetch(), trucksQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trucks.all });
    } catch (error) {
      notifyError("Failed to assign driver to truck");
    }
  }

  async function handleUnassignDriver(driverId: number) {
    const driver = fleetDrivers.find((d) => d.id === driverId);
    if (!driver || !driver.assignedTruckId) {
      notifyError("Driver is not assigned to any truck");
      return;
    }

    try {
      // Unassign by setting truckId to 0 (backend handles this as unassign)
      await assignDriverMutation.mutateAsync({ driverId, truckId: 0 });
      notifySuccess("Driver unassigned from truck");
      setAssigningDriverId(null);
      setSelectedTruckForAssignment(null);
      await Promise.all([driversQuery.refetch(), trucksQuery.refetch()]);
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trucks.all });
    } catch (error) {
      notifyError("Failed to unassign driver");
    }
  }

  // Track assignment changes for real-time notifications (throttled to prevent spam)
  useEffect(() => {
    if (!driversQuery.data || !liveUpdatesEnabled) return;

    const currentAssignments = new Map<number, number | null>();
    fleetDrivers.forEach((driver) => {
      currentAssignments.set(driver.id, driver.assignedTruckId);
    });

    const previous = previousAssignmentsRef.current;

    // Batch notifications - only show first few changes to prevent notification spam
    let changeCount = 0;
    const maxNotifications = 2;

    // Detect new assignments or detachments
    for (const [driverId, currentTruckId] of currentAssignments.entries()) {
      if (changeCount >= maxNotifications) break;

      const previousTruckId = previous.get(driverId);
      if (previousTruckId !== currentTruckId) {
        const driver = fleetDrivers.find((d) => d.id === driverId);
        if (driver) {
          if (currentTruckId !== null && previousTruckId === null) {
            // New assignment
            const truck = fleetTrucks.find((t) => t.id === currentTruckId);
            notifySuccess(
              `${driver.name} assigned to ${truck?.plateNumber ?? `truck ${currentTruckId}`}`
            );
            setRecentAssignments((prev) => new Set([...prev, driverId]));
            setTimeout(() => {
              setRecentAssignments((prev) => {
                const next = new Set(prev);
                next.delete(driverId);
                return next;
              });
            }, 5000);
            changeCount++;
          } else if (currentTruckId === null && previousTruckId !== null) {
            // Detachment - only notify for manual unassignments, not simulation
            // Skip if this is a bulk change (more than 3 changes at once = likely simulation)
            const totalChanges = Array.from(currentAssignments.entries()).filter(
              ([id, truckId]) => previous.get(id) !== truckId
            ).length;
            if (totalChanges <= 3) {
              notifySuccess(`${driver.name} unassigned from truck`);
              changeCount++;
            }
          }
        }
      }
    }

    previousAssignmentsRef.current = currentAssignments;
  }, [driversQuery.data, fleetDrivers, fleetTrucks, liveUpdatesEnabled, notifySuccess]);

  const liveStatus = useSmartPolling({
    queries: [fleetSummaryQuery, swapsQuery, trucksQuery, batteriesQuery, driversQuery, shipmentsQuery],
    enabled: liveUpdatesEnabled,
    intervalMs: 12_000,
  });

  async function onRefresh() {
    await Promise.all([
      fleetsQuery.refetch(),
      stationsQuery.refetch(),
      trucksQuery.refetch(),
      batteriesQuery.refetch(),
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
          <div className="flex items-center gap-2">
            <AsyncActionButton
              label="Export report"
              onClick={async () => {
                const { blob, filename } = await dashboardService.fleetExport(selectedFleetId);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                notifySuccess("Report downloaded");
              }}
            />
            <AsyncActionButton label="Refresh" onClick={onRefresh} />
          </div>
        }
      />

      <FilterBar>
        <select
          value={selectedFleetId}
          onChange={(event) => setPreferredFleetId(Number(event.target.value))}
          disabled={isFleetLocked}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
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

      <section className="dashboard-grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4">
        <KPIStatCard label="Active Trucks" value={String(kpis.activeTrucks)} status={kpiStatus.activeTrucks} />
        <KPIStatCard label="Available Trucks" value={String(kpis.availableTrucks)} status={kpiStatus.availableTrucks} />
        <KPIStatCard label="Active Drivers" value={String(kpis.activeDrivers)} status={kpiStatus.activeDrivers} />
        <KPIStatCard label="Swaps Today" value={String(kpis.swapsToday)} status={kpiStatus.swapsToday} />
        <KPIStatCard
          label="Fleet Energy Cost (ETB)"
          value={Math.round(kpis.fleetEnergyCostEtb).toLocaleString()}
          status={kpiStatus.fleetEnergyCostEtb}
        />
        <KPIStatCard label="Completed Trips" value={String(kpis.completedTrips)} status={kpiStatus.completedTrips} />
        <KPIStatCard
          label="Maintenance Alerts"
          value={String(kpis.maintenanceAlerts)}
          status={kpiStatus.maintenanceAlerts}
        />
        <KPIStatCard
          label="Refrigerated Active"
          value={String(kpis.refrigeratedTrucksActive)}
          status={kpiStatus.refrigeratedTrucksActive}
        />
      </section>

      <article className="panel card-regular">
        <p className="type-label">1) Fleet Corridor Activity Map</p>
        <div className="mt-3 h-72">
          <OperationsCorridorMap
            stations={stationsQuery.data}
            trucks={trucksQuery.data}
            batteries={batteriesQuery.data}
          />
        </div>
      </article>

      <article className="panel card-regular">
        <Tabs
          tabs={[
            { id: "trucks", label: "Trucks" },
            { id: "drivers", label: "Drivers" },
          ]}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as "trucks" | "drivers")}
        >
          <TabPanel id="trucks" activeTab={activeTab}>
            <DataTableWrapper title="Truck Table with Live Status" subtitle="Click a truck row for details">
              <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full min-w-[1200px] text-left text-sm">
                  <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2">License Plate</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Battery ID</th>
                      <th className="px-3 py-2">Driver</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">SOC</th>
                      <th className="px-3 py-2">Last Swap</th>
                      <th className="px-3 py-2">Swaps</th>
                      <th className="px-3 py-2">Energy Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrucks.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-5">
                          <EmptyPlaceholder title="No trucks match filters" />
                        </td>
                      </tr>
                    ) : (
                      trucksPagination.paginatedItems.map((truck) => {
                        const driver = truck.assignedDriverId
                          ? driverById.get(truck.assignedDriverId)
                          : undefined;
                        const energy = truckEnergyByDay.find((item) => item.truckId === truck.id)?.kwhToday ?? 0;
                        const lastSwap = lastSwapByTruck.get(truck.id);
                        const lastSwapStation = lastSwap
                          ? stationById.get(lastSwap.stationId)
                          : null;
                        return (
                          <tr
                            key={truck.id}
                            className="cursor-pointer border-t border-border-subtle hover:bg-background-muted/40"
                            onClick={() => setSelectedTruckId(truck.id)}
                          >
                            <td className="px-3 py-2 font-semibold text-foreground">{truck.plateNumber}</td>
                            <td className="px-3 py-2 text-foreground-muted text-xs">
                              {getTruckLocation(truck)}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted font-mono text-xs">
                              {truck.batteryId}
                            </td>
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
                            <td className="px-3 py-2 text-foreground-muted text-xs">
                              {lastSwap && lastSwapStation ? (
                                <div>
                                  <div>{lastSwapStation.name}</div>
                                  <div className="text-[10px] opacity-70">
                                    {new Date(lastSwap.timestamp).toLocaleDateString()}
                                  </div>
                                </div>
                              ) : (
                                "No swaps"
                              )}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted">{swapsByTruck.get(truck.id) ?? 0}</td>
                            <td className="px-3 py-2 text-foreground-muted">{energy} kWh</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls {...trucksPagination} onPrev={trucksPagination.prev} onNext={trucksPagination.next} />
              </div>
            </DataTableWrapper>
          </TabPanel>

          <TabPanel id="drivers" activeTab={activeTab}>
            <DataTableWrapper title="Drivers Table" subtitle="Click a driver row for details">
              <div className="mt-0 overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                    <tr>
                      <th className="px-3 py-2">Driver Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Rating</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Assigned Truck</th>
                      <th className="px-3 py-2">Truck Location</th>
                      <th className="px-3 py-2">Battery ID</th>
                      <th className="px-3 py-2">Last Swap</th>
                      <th className="px-3 py-2">Safety Score</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleetDrivers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-5">
                          <EmptyPlaceholder title="No drivers in fleet" />
                        </td>
                      </tr>
                    ) : (
                      driversPagination.paginatedItems.map((driver) => {
                        const assignedTruck = driver.assignedTruckId
                          ? fleetTrucks.find((truck) => truck.id === driver.assignedTruckId)
                          : null;
                        const isAttached =
                          assignedTruck !== null &&
                          assignedTruck.assignedDriverId === driver.id &&
                          driver.assignedTruckId === assignedTruck.id;
                        const isAssigning = assigningDriverId === driver.id;
                        const isRecentlyAssigned = recentAssignments.has(driver.id);
                        const lastSwap = assignedTruck ? lastSwapByTruck.get(assignedTruck.id) : null;
                        const lastSwapStation = lastSwap ? stationById.get(lastSwap.stationId) : null;

                        return (
                          <tr
                            key={driver.id}
                            className={`border-t border-border-subtle hover:bg-background-muted/40 ${
                              isRecentlyAssigned ? "bg-success/5" : ""
                            }`}
                          >
                            <td className="px-3 py-2 font-semibold text-foreground">{driver.name}</td>
                            <td className="px-3 py-2 text-foreground-muted text-xs">{driver.phone}</td>
                            <td className="px-3 py-2 text-foreground-muted">
                              <span className="font-medium">{driver.overallRating.toFixed(1)}</span>
                              <span className="text-xs opacity-70">★</span>
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge
                                label={driver.status}
                                variant={driver.status.toUpperCase() === "ACTIVE" ? "success" : "neutral"}
                              />
                            </td>
                            <td className="px-3 py-2 text-foreground-muted">
                              {assignedTruck ? (
                                <span>
                                  {assignedTruck.plateNumber}
                                  {isAttached ? (
                                    <span className="ml-1 text-success text-xs">✓</span>
                                  ) : (
                                    <span className="ml-1 text-warning text-xs">⏳</span>
                                  )}
                                </span>
                              ) : (
                                "Unassigned"
                              )}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted text-xs">
                              {assignedTruck ? getTruckLocation(assignedTruck) : "-"}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted font-mono text-xs">
                              {assignedTruck?.batteryId ?? "-"}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted text-xs">
                              {lastSwapStation ? (
                                <div>
                                  <div>{lastSwapStation.name}</div>
                                  <div className="text-[10px] opacity-70">
                                    {new Date(lastSwap!.timestamp).toLocaleDateString()}
                                  </div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2 text-foreground-muted">
                              {driver.safetyScore.toFixed(0)}
                              {driver.speedViolations > 0 && (
                                <span className="ml-1 text-xs text-warning">
                                  ({driver.speedViolations} violations)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                {isAssigning ? (
                                  <>
                                    <select
                                      value={selectedTruckForAssignment ?? ""}
                                      onChange={(e) =>
                                        setSelectedTruckForAssignment(Number(e.target.value) || null)
                                      }
                                      className="min-w-0 flex-1 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground"
                                      disabled={assignDriverMutation.isPending}
                                    >
                                      <option value="">Select truck...</option>
                                      {availableTrucksForAssignment.map((truck) => (
                                        <option key={truck.id} value={truck.id}>
                                          {truck.plateNumber}
                                        </option>
                                      ))}
                                    </select>
                                    <AsyncActionButton
                                      label="Assign"
                                      onClick={() => handleAssignDriver(driver.id, selectedTruckForAssignment)}
                                      loading={assignDriverMutation.isPending}
                                      className="text-xs shrink-0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAssigningDriverId(null);
                                        setSelectedTruckForAssignment(null);
                                      }}
                                      className="shrink-0 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground hover:bg-background-hover"
                                      disabled={assignDriverMutation.isPending}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAssigningDriverId(driver.id);
                                        setSelectedTruckForAssignment(null);
                                      }}
                                      className="shrink-0 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground hover:bg-background-hover"
                                    >
                                      {assignedTruck ? "Reassign" : "Assign"}
                                    </button>
                                    {assignedTruck && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnassignDriver(driver.id)}
                                        className="shrink-0 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
                                        disabled={assignDriverMutation.isPending}
                                      >
                                        Unassign
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-3">
                <PaginationControls {...driversPagination} onPrev={driversPagination.prev} onNext={driversPagination.next} />
              </div>
            </DataTableWrapper>
          </TabPanel>
        </Tabs>
      </article>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-5">
        <article className="panel card-regular min-w-0">
          <p className="type-label">3) Driver Assignments</p>
          <div className="mt-3 max-h-[400px] space-y-2 overflow-y-auto pr-1">
            {fleetDrivers.length === 0 ? (
              <EmptyPlaceholder title="No drivers in fleet" />
            ) : (
              fleetDrivers.map((driver) => {
                const assignedTruck = driver.assignedTruckId
                  ? fleetTrucks.find((truck) => truck.id === driver.assignedTruckId)
                  : null;
                const isAttached =
                  assignedTruck !== null &&
                  assignedTruck.assignedDriverId === driver.id &&
                  driver.assignedTruckId === assignedTruck.id;
                const isAssigning = assigningDriverId === driver.id;

                const isRecentlyAssigned = recentAssignments.has(driver.id);
                return (
                  <div
                    key={driver.id}
                    className={`rounded-xl border px-3 py-2 transition-all ${
                      isRecentlyAssigned
                        ? "border-success/50 bg-success/5 animate-pulse"
                        : "border-border-subtle"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{driver.name}</p>
                      <StatusBadge
                        label={driver.status}
                        variant={driver.status.toUpperCase() === "ACTIVE" ? "success" : "neutral"}
                      />
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">
                      Truck:{" "}
                      {assignedTruck ? (
                        <span>
                          {assignedTruck.plateNumber}
                          {isAttached ? (
                            <span className="ml-1 text-success font-semibold">✓ Attached</span>
                          ) : (
                            <span className="ml-1 text-warning font-semibold">⏳ Pending Attachment</span>
                          )}
                        </span>
                      ) : (
                        "Unassigned"
                      )}
                      {isRecentlyAssigned && (
                        <span className="ml-2 text-[10px] text-success">(Just assigned)</span>
                      )}
                    </p>
                    {assignedTruck && (
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        Location: {getTruckLocation(assignedTruck)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isAssigning ? (
                        <>
                          <select
                            value={selectedTruckForAssignment ?? ""}
                            onChange={(e) => setSelectedTruckForAssignment(Number(e.target.value) || null)}
                            className="min-w-0 flex-1 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground"
                            disabled={assignDriverMutation.isPending}
                          >
                            <option value="">Select truck...</option>
                            {availableTrucksForAssignment.map((truck) => (
                              <option key={truck.id} value={truck.id}>
                                {truck.plateNumber}
                              </option>
                            ))}
                          </select>
                          <AsyncActionButton
                            label="Assign"
                            onClick={() => handleAssignDriver(driver.id, selectedTruckForAssignment)}
                            loading={assignDriverMutation.isPending}
                            className="text-xs shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningDriverId(null);
                              setSelectedTruckForAssignment(null);
                            }}
                            className="shrink-0 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground hover:bg-background-hover"
                            disabled={assignDriverMutation.isPending}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningDriverId(driver.id);
                              setSelectedTruckForAssignment(null);
                            }}
                            className="shrink-0 rounded border border-border-subtle bg-background-muted px-2 py-1 text-xs text-foreground hover:bg-background-hover"
                          >
                            {assignedTruck ? "Reassign" : "Assign"}
                          </button>
                          {assignedTruck && (
                            <button
                              type="button"
                              onClick={() => handleUnassignDriver(driver.id)}
                              className="shrink-0 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20"
                              disabled={assignDriverMutation.isPending}
                            >
                              Unassign
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <ChartCard title="4) kWh Today by Truck" subtitle="Live truck-level estimate" className="min-w-0">
          {fleetEnergyByTruckQuery.data?.energyByTruck ? (
            <SimpleBarChart
              items={fleetEnergyByTruckQuery.data.energyByTruck.map((t) => ({
                label: t.plateNumber,
                value: t.energyKwh,
              }))}
              valueLabel={(v) => `${v} kWh`}
            />
          ) : null}
        </ChartCard>
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
              <EmptyPlaceholder
                title="No maintenance alerts"
                description="All fleet trucks are clear of maintenance issues."
              />
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
              <p className="text-foreground-muted">License Plate</p>
              <p className="font-semibold text-foreground">{selectedTruck.plateNumber}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Location</p>
              <p className="font-semibold text-foreground">{getTruckLocation(selectedTruck)}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Battery ID</p>
              <p className="font-semibold text-foreground font-mono">{selectedTruck.batteryId}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
              <p className="text-foreground-muted">Assigned Driver</p>
              <p className="font-semibold text-foreground">
                {selectedTruck.assignedDriverId
                  ? driverById.get(selectedTruck.assignedDriverId)?.name ?? "Unknown"
                  : "Unassigned"}
              </p>
            </div>
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
            {lastSwapByTruck.has(selectedTruck.id) ? (
              <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm">
                <p className="text-foreground-muted">Last Swap</p>
                <p className="font-semibold text-foreground">
                  {stationById.get(lastSwapByTruck.get(selectedTruck.id)!.stationId)?.name ?? "Unknown Station"}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  {new Date(lastSwapByTruck.get(selectedTruck.id)!.timestamp).toLocaleString()}
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
