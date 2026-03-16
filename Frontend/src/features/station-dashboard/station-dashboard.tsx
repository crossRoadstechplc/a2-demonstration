"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useAuth } from "@/hooks/use-auth";
import { useSmartPolling } from "@/hooks/use-live-updates";
import { useUiStore } from "@/store/ui-store";

import { BatteryChargingVisualization } from "./components/battery-charging-visualization";
import { StationActivityMap } from "./components/station-activity-map";
import { StationDataGrids } from "./components/station-data-grids";
import { StationKpiGrid } from "./components/station-kpi-grid";
import { StationOverviewCard } from "./components/station-overview-card";
import { SwapPaymentNotifications } from "./components/swap-payment-notifications";
import {
  deriveChargerStatuses,
  deriveIncomingPredictions,
  deriveStationKpis,
  filterStationBatteries,
  resolveStation,
  sortIncidentsBySeverity,
} from "./normalize";
import { StationDashboardSkeleton } from "./station-dashboard-skeleton";

export function StationDashboard() {
  const { role, user } = useAuth();
  // STATION_OPERATOR users are locked to their own station (organizationId = stationId)
  const isStationLocked = role === "STATION_OPERATOR";
  const lockedStationId = isStationLocked && user?.organizationId ? Number(user.organizationId) : null;

  const [preferredStationId, setPreferredStationId] = useState<number>(1);
  const [batteryStatusFilter, setBatteryStatusFilter] = useState("ALL");
  const [chargerStatusFilter, setChargerStatusFilter] = useState("ALL");
  const [stationSearch, setStationSearch] = useState("");
  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);

  const stationsQuery = appQueries.useStations();
  const batteriesQuery = appQueries.useBatteries();
  const swapsQuery = appQueries.useSwaps();
  const trucksQuery = appQueries.useTrucks();

  const selectedStationId = useMemo(() => {
    const stations = stationsQuery.data ?? [];
    if (!stations.length) return 0;
    // Locked role: always use their assigned station
    if (lockedStationId !== null) {
      return stations.some((s) => s.id === lockedStationId) ? lockedStationId : (stations[0]?.id ?? 0);
    }
    if (stations.some((station) => station.id === preferredStationId)) {
      return preferredStationId;
    }
    return stations[0]?.id ?? 0;
  }, [stationsQuery.data, preferredStationId, lockedStationId]);

  const stationSummaryQuery = appQueries.useStationSummary(selectedStationId);
  const incidentsQuery = appQueries.useStationIncidents(selectedStationId);
  const chargerFaultsQuery = appQueries.useStationChargerFaults(selectedStationId);
  const chargingQuery = appQueries.useChargingByStation(selectedStationId);

  const isLoading =
    stationsQuery.isLoading ||
    batteriesQuery.isLoading ||
    swapsQuery.isLoading ||
    trucksQuery.isLoading ||
    stationSummaryQuery.isLoading ||
    incidentsQuery.isLoading ||
    chargerFaultsQuery.isLoading ||
    chargingQuery.isLoading;

  const hasError =
    stationsQuery.isError ||
    batteriesQuery.isError ||
    swapsQuery.isError ||
    trucksQuery.isError ||
    stationSummaryQuery.isError ||
    incidentsQuery.isError ||
    chargerFaultsQuery.isError ||
    chargingQuery.isError;

  const station = useMemo(
    () => resolveStation(stationsQuery.data ?? [], selectedStationId),
    [stationsQuery.data, selectedStationId]
  );

  const stationBatteries = useMemo(
    () =>
      filterStationBatteries(
        batteriesQuery.data ?? [],
        selectedStationId,
        batteryStatusFilter
      ),
    [batteriesQuery.data, selectedStationId, batteryStatusFilter]
  );

  const stationSwaps = useMemo(
    () => (swapsQuery.data ?? []).filter((swap) => swap.stationId === selectedStationId),
    [swapsQuery.data, selectedStationId]
  );

  const trucksAtStation = useMemo(
    () =>
      (trucksQuery.data ?? []).filter((truck) => truck.currentStationId === selectedStationId),
    [trucksQuery.data, selectedStationId]
  );

  const incidentsSorted = useMemo(
    () => sortIncidentsBySeverity(incidentsQuery.data ?? []),
    [incidentsQuery.data]
  );

  const chargerRows = useMemo(
    () =>
      deriveChargerStatuses(
        chargerFaultsQuery.data ?? [],
        stationSummaryQuery.data,
        chargerStatusFilter
      ),
    [chargerFaultsQuery.data, stationSummaryQuery.data, chargerStatusFilter]
  );

  const incomingPredictions = useMemo(
    () => deriveIncomingPredictions(stationSummaryQuery.data),
    [stationSummaryQuery.data]
  );

  const chargingSessions = useMemo(
    () =>
      (chargingQuery.data ?? []).filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object"
      ),
    [chargingQuery.data]
  );

  const filteredStations = useMemo(
    () =>
      (stationsQuery.data ?? []).filter((stationItem) =>
        stationItem.name.toLowerCase().includes(stationSearch.trim().toLowerCase())
      ),
    [stationsQuery.data, stationSearch]
  );

  const kpis = useMemo(
    () =>
      deriveStationKpis({
        stationSummary: stationSummaryQuery.data,
        stationBatteries,
        chargingSessions,
        swaps: stationSwaps,
        faults: chargerFaultsQuery.data ?? [],
        trucksAtStation,
      }),
    [
      stationSummaryQuery.data,
      stationBatteries,
      chargingSessions,
      stationSwaps,
      chargerFaultsQuery.data,
      trucksAtStation,
    ]
  );

  const liveStatus = useSmartPolling({
    queries: [
      stationSummaryQuery,
      incidentsQuery,
      chargerFaultsQuery,
      chargingQuery,
      swapsQuery,
      trucksQuery,
    ],
    enabled: liveUpdatesEnabled,
    intervalMs: 12_000,
  });

  async function onRefresh() {
    await Promise.all([
      stationsQuery.refetch(),
      batteriesQuery.refetch(),
      swapsQuery.refetch(),
      trucksQuery.refetch(),
      stationSummaryQuery.refetch(),
      incidentsQuery.refetch(),
      chargerFaultsQuery.refetch(),
      chargingQuery.refetch(),
    ]);
  }

  if (isLoading) {
    return <StationDashboardSkeleton />;
  }

  if (hasError) {
    return (
      <div className="dashboard-grid grid-cols-1">
        <ErrorState
          title="Unable to load station operations dashboard"
          message="Please verify API availability and station permissions."
        />
        <AsyncActionButton label="Retry refresh" onClick={onRefresh} className="w-fit" />
      </div>
    );
  }

  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="Station Operations"
        title={`${station?.name ?? "Station"} Command Dashboard`}
        description="Battery swap floor, charging bays, queue pressure, and incident visibility."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />

      <FilterBar>
        <SearchInput
          placeholder="Search station name"
          value={stationSearch}
          onChange={setStationSearch}
        />
        <select
          value={selectedStationId}
          onChange={(event) => setPreferredStationId(Number(event.target.value))}
          disabled={isStationLocked}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {filteredStations.map((stationItem) => (
            <option key={stationItem.id} value={stationItem.id}>
              {stationItem.name}
            </option>
          ))}
        </select>
        <select
          value={batteryStatusFilter}
          onChange={(event) => setBatteryStatusFilter(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="ALL">Battery: All</option>
          <option value="READY">Battery: Ready</option>
          <option value="CHARGING">Battery: Charging</option>
          <option value="IN_TRUCK">Battery: In Truck</option>
          <option value="MAINTENANCE">Battery: Maintenance</option>
        </select>
        <select
          value={chargerStatusFilter}
          onChange={(event) => setChargerStatusFilter(event.target.value)}
          className="h-10 rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          <option value="ALL">Charger: All</option>
          <option value="ACTIVE">Charger: Active</option>
          <option value="READY">Charger: Ready</option>
          <option value="FAULT">Charger: Fault</option>
        </select>
        <StatusBadge label={`Station ID ${selectedStationId}`} variant="info" />
        <LiveRefreshIndicator {...liveStatus} />
      </FilterBar>

      <StationKpiGrid kpis={kpis} />

      <StationOverviewCard
        station={station}
        stations={stationsQuery.data}
        trucks={trucksQuery.data}
        batteries={batteriesQuery.data}
      />

      <BatteryChargingVisualization batteries={stationBatteries} />

      <SwapPaymentNotifications swaps={stationSwaps} stationId={selectedStationId} />

      <StationActivityMap
        trucksAtStation={trucksAtStation}
        batteries={stationBatteries}
        chargerStatus={
          (stationSummaryQuery.data as { chargerStatus?: Array<{ chargerId: string; status: string; outputKw: number; batteryId: number | null; energyAddedKwh: number }> })?.chargerStatus ?? chargerRows.map((row) => ({
            chargerId: row.chargerId,
            status: row.status,
            outputKw: row.outputKw,
            batteryId: null,
            energyAddedKwh: 0,
          }))
        }
        swaps={stationSwaps}
        roomTemperature={28}
      />

      <StationDataGrids
        batteries={stationBatteries}
        chargingSessions={chargingSessions}
        swaps={stationSwaps}
        trucksAtStation={trucksAtStation}
        predictions={incomingPredictions}
        chargerRows={chargerRows}
        incidents={incidentsSorted}
        faults={chargerFaultsQuery.data ?? []}
      />
    </div>
  );
}
