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
import { PageHeader } from "@/components/ui/page-header";
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
import {
  deriveAvailableTrucks,
  deriveFreightKpis,
  deriveTrackingEvents,
  estimateFreightPrice,
} from "./normalize";

interface FreightBookingForm {
  pickupLocation: string;
  deliveryLocation: string;
  cargoDescription: string;
  weight: number;
  volume: number;
  pickupWindow: string;
  requiresRefrigeration: boolean;
  temperatureTarget: number;
}

const initialForm: FreightBookingForm = {
  pickupLocation: "Adama Industrial Zone",
  deliveryLocation: "Dire Dawa Warehouse",
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
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FreightBookingForm, string>>>(
    {}
  );

  const shipmentsQuery = appQueries.useShipments();
  const trucksQuery = appQueries.useTrucks();
  const driversQuery = appQueries.useDrivers();
  const stationsQuery = appQueries.useStations();

  const customerId = useMemo(() => {
    const fromUser = Number(user?.organizationId);
    if (Number.isFinite(fromUser) && fromUser > 0) return fromUser;
    const fromShipment = shipmentsQuery.data?.find((item) => item.customerId)?.customerId;
    return fromShipment ?? 1;
  }, [user?.organizationId, shipmentsQuery.data]);

  const freightSummaryQuery = appQueries.useFreightSummary(customerId);

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

  const isLoading =
    shipmentsQuery.isLoading ||
    trucksQuery.isLoading ||
    driversQuery.isLoading ||
    stationsQuery.isLoading ||
    freightSummaryQuery.isLoading;
  const hasError =
    shipmentsQuery.isError ||
    trucksQuery.isError ||
    driversQuery.isError ||
    stationsQuery.isError ||
    freightSummaryQuery.isError;

  const kpis = useMemo(
    () => deriveFreightKpis(shipmentOptions, freightSummaryQuery.data),
    [shipmentOptions, freightSummaryQuery.data]
  );

  const availableTrucks = useMemo(
    () => deriveAvailableTrucks(trucksQuery.data ?? []),
    [trucksQuery.data]
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
    queries: [shipmentsQuery, trackingQuery, shipmentDetailQuery, freightSummaryQuery, trucksQuery],
    enabled: true,
    intervalMs: 12_000,
  });

  async function submitBooking() {
    try {
      const optimisticId = Date.now();
      const optimisticShipment = {
        id: optimisticId,
        customerId,
        status: "REQUESTED",
        pickupLocation: form.pickupLocation,
        deliveryLocation: form.deliveryLocation,
        cargoDescription: form.cargoDescription,
        weight: form.weight,
        volume: form.volume,
        pickupWindow: form.pickupWindow,
        requiresRefrigeration: form.requiresRefrigeration ? 1 : 0,
        temperatureTarget: form.requiresRefrigeration ? form.temperatureTarget : null,
      };
      queryClient.setQueryData(queryKeys.freight.all, (old: unknown) => {
        if (!Array.isArray(old)) return [optimisticShipment];
        return [optimisticShipment, ...old];
      });

      const shipment = await createShipmentMutation.mutateAsync({
        pickupLocation: form.pickupLocation,
        deliveryLocation: form.deliveryLocation,
        cargoDescription: form.cargoDescription,
        weight: form.weight,
        volume: form.volume,
        pickupWindow: form.pickupWindow,
        requiresRefrigeration: form.requiresRefrigeration,
        temperatureTarget: form.requiresRefrigeration ? form.temperatureTarget : undefined,
      });
      notifySuccess("Shipment request created successfully");
      setSelectedShipmentId(shipment.id);
      await Promise.all([shipmentsQuery.refetch(), freightSummaryQuery.refetch()]);
    } catch {
      await shipmentsQuery.refetch();
      notifyError("Failed to create shipment request");
    }
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof FreightBookingForm, string>> = {};
    if (!form.pickupLocation.trim()) errors.pickupLocation = "Pickup location is required.";
    if (!form.deliveryLocation.trim()) errors.deliveryLocation = "Delivery destination is required.";
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

      <section className="dashboard-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <KPIStatCard label="Total Shipments" value={String(kpis.totalShipments)} status="neutral" />
        <KPIStatCard label="Active Shipments" value={String(kpis.activeShipments)} status="info" />
        <KPIStatCard
          label="Delivered Shipments"
          value={String(kpis.deliveredShipments)}
          status="success"
        />
        <KPIStatCard label="Estimated Spend" value={formatEtb(kpis.estimatedSpendEtb)} status="warning" />
        <KPIStatCard
          label="Refrigerated Shipments"
          value={String(kpis.refrigeratedShipments)}
          status="info"
        />
        <KPIStatCard
          label="Pending Delivery Confirmations"
          value={String(kpis.pendingDeliveryConfirmations)}
          status={kpis.pendingDeliveryConfirmations > 0 ? "warning" : "success"}
        />
      </section>

      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular xl:col-span-2">
          <p className="type-label">1) New Freight Booking Form</p>
          <form className="mt-3 space-y-3" onSubmit={onSubmitBooking}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormField label="Pickup Location" error={formErrors.pickupLocation}>
                <input
                  value={form.pickupLocation}
                  onChange={(event) => setForm((old) => ({ ...old, pickupLocation: event.target.value }))}
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                />
              </FormField>
              <FormField label="Delivery Destination" error={formErrors.deliveryLocation}>
                <input
                  value={form.deliveryLocation}
                  onChange={(event) => setForm((old) => ({ ...old, deliveryLocation: event.target.value }))}
                  className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                  required
                />
              </FormField>
            </div>

            <FormField label="Cargo Description" error={formErrors.cargoDescription}>
              <input
                value={form.cargoDescription}
                onChange={(event) => setForm((old) => ({ ...old, cargoDescription: event.target.value }))}
                className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-sm text-foreground"
                required
              />
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
            ) : (
              availableTrucks.map((truck, index) => (
                <div key={truck.id} className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{truck.plateNumber}</p>
                    {index === 0 ? <StatusBadge label="Best Match" variant="success" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    SOC {truck.currentSoc}% · {truck.truckType}
                  </p>
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
          <div className="mt-3 h-52 rounded-xl border border-border-subtle bg-[linear-gradient(180deg,#0b1322,#091120)] p-3">
            <p className="text-sm text-foreground-muted">Map placeholder with corridor route and live markers</p>
            <p className="mt-2 text-sm text-foreground">
              {selectedShipment
                ? `${selectedShipment.pickupLocation} → ${selectedShipment.deliveryLocation}`
                : "Select shipment to track"}
            </p>
          </div>
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
          {form.pickupLocation} to {form.deliveryLocation} · {formatEtb(estimatedPrice)}
        </div>
      </ConfirmModal>
    </div>
  );
}
