"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { KPIStatCard } from "@/components/dashboard/kpi-stat-card";
import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTableWrapper } from "@/components/ui/data-table-wrapper";
import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormField } from "@/components/ui/form-field";
import { OperationsCorridorMap } from "@/components/dashboard/operations-corridor-map";
import { PageHeader } from "@/components/ui/page-header";
import type { Station } from "@/types/station";
import { StatusBadge } from "@/components/ui/status-badge";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { queryKeys } from "@/constants/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { appQueries } from "@/hooks/queries/use-app-data";
import { useSmartPolling } from "@/hooks/use-live-updates";
import { useAppMutation, useAppQuery } from "@/lib/query";
import { freightService } from "@/services/freight.service";
import { useNotificationStore } from "@/store/notification-store";

import { FreightDashboardSkeleton } from "./freight-dashboard-skeleton";
import { deriveFreightKpiStatus } from "./freight-kpi-thresholds";
import {
  deriveAvailableTrucks,
  deriveFreightKpis,
  deriveTrackingEvents,
  estimateFreightPrice,
  type AvailableTruckWithDistance,
} from "./normalize";

interface FreightBookingForm {
  pickupStationId: number | null;
  deliveryStationId: number | null;
  cargoDescription: string;
  weight: number;
  volume: number;
  pickupWindow: string;
  requiresRefrigeration: boolean;
  temperatureTarget: number;
}

const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Addis Ababa (Main Hub)": { lat: 8.9806, lng: 38.7578 },
  Adama: { lat: 8.54, lng: 39.27 },
  Awash: { lat: 8.98, lng: 40.17 },
  Mieso: { lat: 9.24, lng: 40.75 },
  "Dire Dawa": { lat: 9.6, lng: 41.86 },
  "Semera / Mille area": { lat: 11.79, lng: 41.01 },
  "Djibouti Port Gateway": { lat: 11.58, lng: 43.15 },
};

function getStationCoords(stationName: string): { lat: number; lng: number } | null {
  return STATION_COORDS[stationName] ?? null;
}

const initialForm: FreightBookingForm = {
  pickupStationId: null,
  deliveryStationId: null,
  cargoDescription: "Coffee Sacks",
  weight: 8.5,
  volume: 18,
  pickupWindow: "06:00-10:00",
  requiresRefrigeration: false,
  temperatureTarget: 4,
};

function formatEtb(value: number): string {
  return `ETB ${Math.round(value).toLocaleString()}`;
}

export function FreightDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const notifySuccess = useNotificationStore((state) => state.success);
  const notifyError = useNotificationStore((state) => state.error);

  const [form, setForm] = useState<FreightBookingForm>(initialForm);
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [kpiTimeframe, setKpiTimeframe] = useState<"daily" | "monthly" | "yearly">("daily");
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FreightBookingForm, string>>>(
    {}
  );

  const shipmentsQuery = appQueries.useShipments();
  const trucksQuery = appQueries.useTrucks();
  const batteriesQuery = appQueries.useBatteries();
  const driversQuery = appQueries.useDrivers();
  const stationsQuery = appQueries.useStations();

  const customerId = useMemo(() => {
    // For freight customers, customerId should equal their user id
    if (user?.role === "FREIGHT_CUSTOMER") {
      // Try user.id first (preferred)
      if (user.id && Number.isFinite(Number(user.id))) {
        return Number(user.id);
      }
      // Fallback to organizationId (which should equal user.id for freight customers)
      if (user.organizationId && Number.isFinite(Number(user.organizationId))) {
        return Number(user.organizationId);
      }
      // If neither is available, try to get from shipments
      const fromShipment = shipmentsQuery.data?.find((item) => item.customerId)?.customerId;
      if (fromShipment && Number.isFinite(Number(fromShipment))) {
        return Number(fromShipment);
      }
      // Last resort: return 0 to prevent invalid API calls
      console.warn("Freight customer ID not found. User:", user);
      return 0;
    }
    // For other roles, use organizationId
    const fromUser = Number(user?.organizationId);
    if (Number.isFinite(fromUser) && fromUser > 0) return fromUser;
    const fromShipment = shipmentsQuery.data?.find((item) => item.customerId)?.customerId;
    return fromShipment ?? 1;
  }, [user?.id, user?.role, user?.organizationId, shipmentsQuery.data]);

  const freightSummaryQuery = appQueries.useFreightSummary(
    customerId > 0 ? customerId : 0,
    kpiTimeframe
  );

  const shipmentOptions = useMemo(() => shipmentsQuery.data ?? [], [shipmentsQuery.data]);
  const defaultShipmentId =
    selectedShipmentId ??
    shipmentOptions.find((item) => item.status === "IN_TRANSIT")?.id ??
    shipmentOptions[0]?.id ??
    null;

  const shipmentDetailQuery = useAppQuery({
    queryKey: queryKeys.freight.byId(defaultShipmentId ?? -1),
    queryFn: () => freightService.getById(defaultShipmentId as number),
    enabled: Boolean(defaultShipmentId),
  });

  const trackingQuery = useAppQuery({
    queryKey: queryKeys.freight.tracking(defaultShipmentId ?? -1),
    queryFn: () => freightService.tracking(defaultShipmentId as number),
    enabled: Boolean(defaultShipmentId),
    staleTime: 20_000,
  });

  const createShipmentMutation = useAppMutation(freightService.request);

  // Show error if customer ID cannot be determined for freight customers
  if (user?.role === "FREIGHT_CUSTOMER" && customerId === 0) {
    return (
      <div className="panel panel-padding">
        <PageHeader title="Freight Dashboard" />
        <ErrorState
          title="Unable to load"
          message="Please log in again."
        />
      </div>
    );
  }

  const isLoading =
    shipmentsQuery.isLoading ||
    trucksQuery.isLoading ||
    batteriesQuery.isLoading ||
    driversQuery.isLoading ||
    stationsQuery.isLoading ||
    freightSummaryQuery.isLoading;
  const hasError =
    shipmentsQuery.isError ||
    trucksQuery.isError ||
    batteriesQuery.isError ||
    driversQuery.isError ||
    stationsQuery.isError ||
    freightSummaryQuery.isError;

  const kpis = useMemo(
    () => deriveFreightKpis(shipmentOptions, freightSummaryQuery.data),
    [shipmentOptions, freightSummaryQuery.data]
  );

  const kpiStatus = useMemo(() => deriveFreightKpiStatus(kpis), [kpis]);

  // Get stations where trucks are parked (fleet stations)
  const fleetStations = useMemo(() => {
    const trucks = trucksQuery.data ?? [];
    const stationIds = new Set<number>();
    trucks.forEach((truck) => {
      if (truck.currentStationId !== null) {
        stationIds.add(truck.currentStationId);
      }
    });
    return (stationsQuery.data ?? []).filter((station) => stationIds.has(station.id));
  }, [trucksQuery.data, stationsQuery.data]);

  // All selectable stations (7 corridor stations + fleet stations)
  const selectableStations = useMemo(() => {
    const allStations = stationsQuery.data ?? [];
    const stationMap = new Map<number, Station>();
    allStations.forEach((station) => {
      stationMap.set(station.id, station);
    });
    return Array.from(stationMap.values());
  }, [stationsQuery.data]);

  // Get pickup station coordinates
  const pickupStation = useMemo(() => {
    if (form.pickupStationId === null) return null;
    return selectableStations.find((s) => s.id === form.pickupStationId) ?? null;
  }, [form.pickupStationId, selectableStations]);

  const pickupCoords = useMemo(() => {
    if (!pickupStation) return { lat: null, lng: null };
    const coords = getStationCoords(pickupStation.name);
    return coords ? { lat: coords.lat, lng: coords.lng } : { lat: null, lng: null };
  }, [pickupStation]);

  const availableTrucks = useMemo(
    () => deriveAvailableTrucks(trucksQuery.data ?? [], pickupCoords.lat, pickupCoords.lng),
    [trucksQuery.data, pickupCoords.lat, pickupCoords.lng]
  );

  const selectedShipment = shipmentDetailQuery.data;
  const trackingEvents = useMemo(
    () => deriveTrackingEvents(trackingQuery.data, selectedShipment),
    [trackingQuery.data, selectedShipment]
  );

  const assignedTruck = selectedShipment?.truckId
    ? (trucksQuery.data ?? []).find((truck) => truck.id === selectedShipment.truckId) ?? null
    : null;

  const assignedDriver = selectedShipment?.driverId
    ? (driversQuery.data ?? []).find((driver) => driver.id === selectedShipment.driverId) ?? null
    : null;

  const estimatedPrice = useMemo(
    () =>
      estimateFreightPrice({
        weight: form.weight,
        volume: form.volume,
        requiresRefrigeration: form.requiresRefrigeration,
      }),
    [form.weight, form.volume, form.requiresRefrigeration]
  );

  const deliveryConfirmations = useMemo(
    () =>
      shipmentOptions.filter(
        (item) => item.status === "DELIVERED" && Boolean(item.deliveryConfirmedAt)
      ),
    [shipmentOptions]
  );

  const liveStatus = useSmartPolling({
    queries: [
      shipmentsQuery,
      trackingQuery,
      shipmentDetailQuery,
      freightSummaryQuery,
      trucksQuery,
      batteriesQuery,
    ],
    enabled: true,
    intervalMs: 12_000,
  });

  async function submitBooking() {
    if (form.pickupStationId === null || form.deliveryStationId === null) {
      notifyError("Please select pickup and delivery stations.");
      return;
    }

    const pickupStation = selectableStations.find((s) => s.id === form.pickupStationId);
    const deliveryStation = selectableStations.find((s) => s.id === form.deliveryStationId);

    if (!pickupStation || !deliveryStation) {
      notifyError("Selected stations not found.");
      return;
    }

    const pickupCoords = getStationCoords(pickupStation.name);
    const deliveryCoords = getStationCoords(deliveryStation.name);

    if (!pickupCoords || !deliveryCoords) {
      notifyError("Station coordinates not available.");
      return;
    }

    try {
      const shipment = await createShipmentMutation.mutateAsync({
        pickupLocation: pickupStation.name,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        deliveryLocation: deliveryStation.name,
        deliveryLat: deliveryCoords.lat,
        deliveryLng: deliveryCoords.lng,
        cargoDescription: form.cargoDescription,
        weight: form.weight,
        volume: form.volume,
        pickupWindow: form.pickupWindow,
        requiresRefrigeration: form.requiresRefrigeration,
        temperatureTarget: form.requiresRefrigeration ? form.temperatureTarget : undefined,
      });
      notifySuccess("Shipment request created successfully");
      setSelectedShipmentId(shipment.id);
      setForm(initialForm);
      await Promise.all([shipmentsQuery.refetch(), freightSummaryQuery.refetch()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create shipment request";
      notifyError(message, "Booking failed");
    }
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof FreightBookingForm, string>> = {};
    if (form.pickupStationId === null) {
      errors.pickupStationId = "Pickup station must be selected.";
    }
    if (form.deliveryStationId === null) {
      errors.deliveryStationId = "Delivery station must be selected.";
    }
    if (form.pickupStationId !== null && form.deliveryStationId !== null && form.pickupStationId === form.deliveryStationId) {
      errors.deliveryStationId = "Delivery station must be different from pickup station.";
    }
    if (!form.cargoDescription.trim()) errors.cargoDescription = "Cargo description is required.";
    if (!(form.weight > 0)) errors.weight = "Weight must be greater than zero.";
    if (!(form.volume > 0)) errors.volume = "Volume must be greater than zero.";
    if (!form.pickupWindow.trim()) errors.pickupWindow = "Pickup time window is required.";
    if (form.requiresRefrigeration && !(form.temperatureTarget <= 10 && form.temperatureTarget >= -30)) {
      errors.temperatureTarget = "Temperature target should be between -30 and 10 C.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmitBooking(event: FormEvent) {
    event.preventDefault();
    if (!validateForm()) {
      notifyError("Please fix booking form validation errors.");
      return;
    }
    setShowConfirmModal(true);
  }

  async function onRefresh() {
    await Promise.all([
      shipmentsQuery.refetch(),
      trucksQuery.refetch(),
      batteriesQuery.refetch(),
      driversQuery.refetch(),
      stationsQuery.refetch(),
      freightSummaryQuery.refetch(),
      shipmentDetailQuery.refetch(),
      trackingQuery.refetch(),
    ]);
  }

  if (isLoading) return <FreightDashboardSkeleton />;

  if (hasError) {
    return (
      <div className="dashboard-grid grid-cols-1">
        <ErrorState title="Unable to load freight customer dashboard" />
        <AsyncActionButton label="Retry" onClick={onRefresh} className="w-fit" />
      </div>
    );
  }

  return (
    <div className="dashboard-grid grid-cols-1">
      <PageHeader
        eyebrow="A2 Freight Customer Portal"
        title="Book & Track Shipments"
        description="Create shipment requests, monitor live movements, and confirm deliveries."
        actions={
          <AsyncActionButton label="Refresh" onClick={onRefresh} />
        }
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">KPI Timeframe:</label>
          <select
            value={kpiTimeframe}
            onChange={(e) => setKpiTimeframe(e.target.value as "daily" | "monthly" | "yearly")}
            className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <KPIStatCard
          label={`Total Shipments (${kpiTimeframe})`}
          value={String(kpis.totalShipments)}
          status={kpiStatus.totalShipments}
        />
        <KPIStatCard
          label={`Active Shipments (${kpiTimeframe})`}
          value={String(kpis.activeShipments)}
          status={kpiStatus.activeShipments}
        />
        <KPIStatCard
          label={`Delivered Shipments (${kpiTimeframe})`}
          value={String(kpis.deliveredShipments)}
          status={kpiStatus.deliveredShipments}
        />
        <KPIStatCard
          label={`Estimated Spend (${kpiTimeframe})`}
          value={formatEtb(kpis.estimatedSpendEtb)}
          status={kpiStatus.estimatedSpendEtb}
        />
        <KPIStatCard
          label={`Refrigerated Shipments (${kpiTimeframe})`}
          value={String(kpis.refrigeratedShipments)}
          status={kpiStatus.refrigeratedShipments}
        />
        <KPIStatCard
          label={`Pending Delivery Confirmations (${kpiTimeframe})`}
          value={String(kpis.pendingDeliveryConfirmations)}
          status={kpiStatus.pendingDeliveryConfirmations}
        />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular xl:col-span-2">
          <p className="type-label">1) New Freight Booking Form</p>
          <form className="mt-3 space-y-3" onSubmit={onSubmitBooking}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Pickup Station" error={formErrors.pickupStationId}>
                <select
                  value={form.pickupStationId ?? ""}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      pickupStationId: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                >
                  <option value="">Select pickup station</option>
                  {selectableStations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} {station.location ? `(${station.location})` : ""}
                    </option>
                  ))}
                </select>
                {pickupStation && (
                  <p className="mt-1 text-xs text-foreground-muted">
                    {fleetStations.some((s) => s.id === pickupStation.id)
                      ? "✓ Trucks available at this station"
                      : "No trucks currently parked here"}
                  </p>
                )}
              </FormField>
              <FormField label="Delivery Station" error={formErrors.deliveryStationId}>
                <select
                  value={form.deliveryStationId ?? ""}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      deliveryStationId: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                >
                  <option value="">Select delivery station</option>
                  {selectableStations.map((station) => (
                    <option key={station.id} value={station.id}>
                      {station.name} {station.location ? `(${station.location})` : ""}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Cargo Description" error={formErrors.cargoDescription}>
              <textarea
                value={form.cargoDescription}
                onChange={(event) => setForm((old) => ({ ...old, cargoDescription: event.target.value }))}
                className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-3 text-sm text-foreground"
                rows={4}
                maxLength={500}
                placeholder="Describe the cargo in detail (e.g., type, packaging, special handling requirements)"
                required
              />
              <p className="mt-1 text-xs text-foreground-muted">
                {form.cargoDescription.length}/500 characters
              </p>
            </FormField>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FormField label="Weight (tonnes)" error={formErrors.weight}>
                <input
                  type="number"
                  step="0.1"
                  value={form.weight}
                  onChange={(event) => setForm((old) => ({ ...old, weight: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                />
              </FormField>
              <FormField label="Volume (m3)" error={formErrors.volume}>
                <input
                  type="number"
                  step="0.1"
                  value={form.volume}
                  onChange={(event) => setForm((old) => ({ ...old, volume: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                />
              </FormField>
              <FormField label="Pickup Time Window" error={formErrors.pickupWindow}>
                <input
                  value={form.pickupWindow}
                  onChange={(event) => setForm((old) => ({ ...old, pickupWindow: event.target.value }))}
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                />
              </FormField>
            </div>

            <div className="rounded-xl border border-border-subtle bg-background-muted p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">Requires Refrigeration</span>
                <input
                  type="checkbox"
                  checked={form.requiresRefrigeration}
                  onChange={(event) =>
                    setForm((old) => ({ ...old, requiresRefrigeration: event.target.checked }))
                  }
                />
              </label>
              {form.requiresRefrigeration ? (
                <FormField
                  label="Temperature Target (°C)"
                  error={formErrors.temperatureTarget}
                >
                  <input
                    type="number"
                    value={form.temperatureTarget}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, temperatureTarget: Number(event.target.value) }))
                    }
                    className="w-full rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm text-foreground"
                    required
                  />
                </FormField>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2">
              <div>
                <p className="text-xs text-foreground-muted">3) Estimated Freight Price</p>
                <p className="text-2xl font-semibold text-warning">{formatEtb(estimatedPrice)}</p>
              </div>
              <AsyncActionButton
                type="submit"
                label="Submit Booking"
                loadingLabel="Submitting..."
                loading={createShipmentMutation.isPending}
              />
            </div>
          </form>
        </article>

        <article className="panel card-regular">
          <p className="type-label">2) Available Trucks Near Pickup</p>
          <div className="mt-3 space-y-2">
            {availableTrucks.length === 0 ? (
              <EmptyPlaceholder title="No available trucks" />
            ) : form.pickupStationId === null ? (
              <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground-muted">
                Select pickup station to see distance-based ranking
              </div>
            ) : (
              availableTrucks.map((truck, index) => (
                <div key={truck.id} className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        License Plate: {truck.plateNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        Location: {truck.locationLabel}
                        {truck.simulatedLat !== null && truck.simulatedLat !== undefined && (
                          <span className="ml-1 text-[10px] opacity-60">(simulated)</span>
                        )}
                      </p>
                    </div>
                    {index === 0 ? <StatusBadge label="Top Match" variant="success" /> : null}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-foreground-muted">
                      {truck.distanceKm !== null
                        ? `${truck.distanceKm.toFixed(1)} km from pickup`
                        : form.pickupStationId === null
                          ? "Select pickup station to see distance"
                          : "Distance unavailable"}
                    </span>
                    <span className="text-foreground-muted">
                      SOC {truck.currentSoc}% · {truck.truckType}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <FilterBar>
        <label className="text-sm text-foreground-muted">Tracked Shipment</label>
        <select
          value={defaultShipmentId ?? ""}
          onChange={(event) => setSelectedShipmentId(Number(event.target.value))}
          className="h-10 min-w-[260px] rounded-xl border border-border-subtle bg-background-muted px-3 text-sm text-foreground"
        >
          {shipmentOptions.map((shipment) => (
            <option key={shipment.id} value={shipment.id}>
              #{shipment.id} · {shipment.pickupLocation} → {shipment.deliveryLocation} ({shipment.status})
            </option>
          ))}
        </select>
        <LiveRefreshIndicator {...liveStatus} />
      </FilterBar>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">4) Assigned Truck & Driver</p>
          {!selectedShipment ? (
            <EmptyPlaceholder title="No shipment selected" />
          ) : (
            <div className="mt-3 space-y-2 rounded-xl border border-border-subtle bg-background-muted p-3">
              <p className="text-sm text-foreground">
                Shipment <strong>#{selectedShipment.id}</strong>
              </p>
              <p className="text-sm text-foreground-muted">Truck: {assignedTruck?.plateNumber ?? "Pending assignment"}</p>
              <p className="text-sm text-foreground-muted">Driver: {assignedDriver?.name ?? "Pending assignment"}</p>
              <StatusBadge label={selectedShipment.status} variant="info" />
            </div>
          )}
        </article>

        <article className="panel card-regular xl:col-span-2">
          <p className="type-label">5) Shipment Tracking Map</p>
          <div className="mt-3 h-64">
            <OperationsCorridorMap
              stations={stationsQuery.data}
              trucks={trucksQuery.data}
              batteries={batteriesQuery.data}
            />
          </div>
          <p className="mt-2 text-sm text-foreground">
            {selectedShipment
              ? `${selectedShipment.pickupLocation} → ${selectedShipment.deliveryLocation}`
              : "Select shipment to track"}
          </p>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular xl:col-span-2">
          <p className="type-label">6) Delivery Timeline</p>
          <div className="mt-3 space-y-3">
            {trackingEvents.length === 0 ? (
              <EmptyPlaceholder title="No tracking timeline available" />
            ) : (
              trackingEvents.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-1">
                    <span
                      className={`block h-3 w-3 rounded-full ${
                        event.status === "done"
                          ? "bg-success"
                          : event.status === "active"
                            ? "bg-warning"
                            : "bg-neutral"
                      }`}
                    />
                  </div>
                  <div className="flex-1 rounded-xl border border-border-subtle px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{event.title}</p>
                      <StatusBadge
                        label={event.status}
                        variant={
                          event.status === "done"
                            ? "success"
                            : event.status === "active"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-foreground-muted">{event.detail}</p>
                    <p className="mt-1 text-xs text-foreground-muted">{event.timestamp}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">7) Delivery Confirmation Records</p>
          <div className="mt-3 space-y-2">
            {deliveryConfirmations.length === 0 ? (
              <EmptyPlaceholder title="No confirmed deliveries yet" />
            ) : (
              deliveryConfirmations.slice(0, 8).map((shipment) => (
                <div key={shipment.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm text-foreground">Shipment #{shipment.id}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Confirmed {shipment.deliveryConfirmedAt ?? "N/A"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <DataTableWrapper title="8) Shipment History Table">
        <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
              <tr>
                <th className="px-3 py-2">Shipment</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Cargo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Refrigerated</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">Volume</th>
              </tr>
            </thead>
            <tbody>
              {shipmentOptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-5">
                    <EmptyPlaceholder title="No shipments found" />
                  </td>
                </tr>
              ) : (
                shipmentOptions.map((shipment) => (
                  <tr key={shipment.id} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-foreground">#{shipment.id}</td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {shipment.pickupLocation} → {shipment.deliveryLocation}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{shipment.cargoDescription}</td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={shipment.status}
                        variant={
                          shipment.status === "DELIVERED"
                            ? "success"
                            : shipment.status === "IN_TRANSIT"
                              ? "info"
                              : shipment.status === "ASSIGNED"
                                ? "warning"
                                : "neutral"
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {shipment.requiresRefrigeration ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{shipment.weight}</td>
                    <td className="px-3 py-2 text-foreground-muted">{shipment.volume}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DataTableWrapper>

      {(form.requiresRefrigeration || selectedShipment?.requiresRefrigeration === 1) && (
        <article className="panel card-regular">
          <p className="type-label">9) Refrigerated Shipment Controls</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2">
              <p className="text-xs text-foreground-muted">Temperature Target</p>
              <p className="text-lg font-semibold text-foreground">
                {form.requiresRefrigeration
                  ? `${form.temperatureTarget}°C`
                  : `${selectedShipment?.temperatureTarget ?? 4}°C`}
              </p>
            </div>
            <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2">
              <p className="text-xs text-foreground-muted">Current Cargo Mode</p>
              <p className="text-lg font-semibold text-foreground">Refrigerated</p>
            </div>
            <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2">
              <p className="text-xs text-foreground-muted">Monitoring</p>
              <p className="text-lg font-semibold text-success">Enabled</p>
            </div>
          </div>
        </article>
      )}

      <ConfirmModal
        open={showConfirmModal}
        title="Confirm Freight Booking"
        message="Submit this shipment request to the A2 corridor booking pipeline?"
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={async () => {
          setShowConfirmModal(false);
          await submitBooking();
        }}
        confirmLabel="Confirm Booking"
        confirming={createShipmentMutation.isPending}
      >
        <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-xs text-foreground-muted">
          {pickupStation?.name ?? "Pickup"} to {selectableStations.find((s) => s.id === form.deliveryStationId)?.name ?? "Delivery"} · {formatEtb(estimatedPrice)}
        </div>
      </ConfirmModal>
    </div>
  );
}
