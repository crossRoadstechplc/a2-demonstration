import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { usePagination } from "@/hooks/use-pagination";
import type { Battery } from "@/types/battery";
import type { ChargerFault, StationIncident } from "@/types/station";
import type { SwapTransaction } from "@/types/swap";
import type { Truck } from "@/types/truck";
import type { ChargerStatusRow, IncomingPrediction } from "../normalize";

type ChargingSession = Record<string, unknown>;

interface StationDataGridsProps {
  batteries: Battery[];
  chargingSessions: ChargingSession[];
  swaps: SwapTransaction[];
  trucksAtStation: Truck[];
  predictions: IncomingPrediction[];
  chargerRows: ChargerStatusRow[];
  incidents: StationIncident[];
  faults: ChargerFault[];
}

function batteryVariant(status: Battery["status"]) {
  if (status === "READY") return "success";
  if (status === "CHARGING") return "warning";
  if (status === "IN_TRUCK") return "info";
  return "neutral";
}

export function StationDataGrids({
  batteries,
  chargingSessions,
  swaps,
  trucksAtStation,
  predictions,
  chargerRows,
  incidents,
  faults,
}: StationDataGridsProps) {
  const batteriesPagination = usePagination(batteries, 10);
  const sessionsPagination = usePagination(chargingSessions, 8);
  const swapsPagination = usePagination(swaps, 8);
  const trucksPagination = usePagination(trucksAtStation, 8);
  const incidentsPagination = usePagination(incidents, 8);
  const chargerPagination = usePagination(chargerRows, 12);
  const readyBatteries = batteries.filter((battery) => battery.status === "READY").slice(0, 8);

  return (
    <>
      <section className="dashboard-grid grid-cols-1 xl:grid-cols-3">
        <article className="panel card-regular xl:col-span-2">
          <p className="type-label">2) Battery Inventory Table</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="bg-background-muted text-xs uppercase tracking-wider text-foreground-muted">
                <tr>
                  <th className="px-3 py-2">Battery ID</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">SOC</th>
                  <th className="px-3 py-2">Health</th>
                  <th className="px-3 py-2">Cycle Count</th>
                  <th className="px-3 py-2">Temp</th>
                </tr>
              </thead>
              <tbody>
                {batteries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-5">
                      <EmptyPlaceholder title="No batteries at this station" />
                    </td>
                  </tr>
                ) : (
                  batteriesPagination.paginatedItems.map((battery) => (
                    <tr key={battery.id} className="border-t border-border-subtle">
                      <td className="px-3 py-2 text-foreground">BAT-{battery.id}</td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          label={battery.status}
                          variant={batteryVariant(battery.status)}
                        />
                      </td>
                      <td className="px-3 py-2 text-foreground-muted">{battery.soc}%</td>
                      <td className="px-3 py-2 text-foreground-muted">{battery.health}%</td>
                      <td className="px-3 py-2 text-foreground-muted">{battery.cycleCount}</td>
                      <td className="px-3 py-2 text-foreground-muted">{battery.temperature}°C</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls {...batteriesPagination} onPrev={batteriesPagination.prev} onNext={batteriesPagination.next} />
        </article>

        <article className="panel card-regular">
          <p className="type-label">3) Batteries Ready for Swap</p>
          <div className="mt-3 space-y-2">
            {readyBatteries.length === 0 ? (
              <EmptyPlaceholder title="No ready batteries" />
            ) : (
              readyBatteries.map((battery) => (
                <div
                  key={battery.id}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">BAT-{battery.id}</p>
                    <StatusBadge label="READY" variant="success" />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    SOC {battery.soc}% · Health {battery.health}%
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">4) Charging Sessions List</p>
          <div className="mt-3 space-y-2">
            {chargingSessions.length === 0 ? (
              <EmptyPlaceholder
                title="No active charging sessions"
                description="No batteries are currently charging at this station."
              />
            ) : (
              sessionsPagination.paginatedItems.map((session, index) => (
                <div
                  key={`${index}`}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <p className="text-sm text-foreground">Session #{(sessionsPagination.page - 1) * sessionsPagination.pageSize + index + 1}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Battery {String(session.batteryId ?? "-")} · Status{" "}
                    {String(session.status ?? "ACTIVE")}
                  </p>
                </div>
              ))
            )}
          </div>
          <PaginationControls {...sessionsPagination} onPrev={sessionsPagination.prev} onNext={sessionsPagination.next} />
        </article>

        <article className="panel card-regular">
          <p className="type-label">5) Swap Transaction History</p>
          <div className="mt-3 space-y-2">
            {swaps.length === 0 ? (
              <EmptyPlaceholder
                title="No swap transactions today"
                description="No swaps completed at this station yet today."
              />
            ) : (
              swapsPagination.paginatedItems.map((swap) => (
                <div
                  key={swap.id}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <p className="text-sm text-foreground">Swap #{swap.id}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Truck {swap.truckId} · Energy {Math.round(swap.energyDeliveredKwh)} kWh
                  </p>
                </div>
              ))
            )}
          </div>
          <PaginationControls {...swapsPagination} onPrev={swapsPagination.prev} onNext={swapsPagination.next} />
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">6) Trucks Currently at Station</p>
          <div className="mt-3 space-y-2">
            {trucksAtStation.length === 0 ? (
              <EmptyPlaceholder title="No trucks currently parked" />
            ) : (
              trucksPagination.paginatedItems.map((truck) => (
                <div key={truck.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{truck.plateNumber}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    SOC {truck.currentSoc}% · {truck.status}
                  </p>
                </div>
              ))
            )}
          </div>
          <PaginationControls {...trucksPagination} onPrev={trucksPagination.prev} onNext={trucksPagination.next} />
        </article>

        <article className="panel card-regular">
          <p className="type-label">7) Incidents</p>
          <div className="mt-3 space-y-2">
            {incidents.length === 0 ? (
              <EmptyPlaceholder
                title="No incidents"
                description="Station operating normally."
              />
            ) : (
              incidentsPagination.paginatedItems.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-xl border border-border-subtle px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{incident.type ?? "Incident"}</p>
                    <StatusBadge
                      label={incident.severity}
                      variant={
                        incident.severity === "CRITICAL"
                          ? "danger"
                          : incident.severity === "HIGH"
                            ? "warning"
                            : "info"
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">{incident.message ?? ""}</p>
                </div>
              ))
            )}
          </div>
          <PaginationControls {...incidentsPagination} onPrev={incidentsPagination.prev} onNext={incidentsPagination.next} />
        </article>

        <article className="panel card-regular">
          <p className="type-label">8) Charger Operational Status</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chargerRows.length === 0 ? (
              <EmptyPlaceholder
                title="No charger telemetry available"
                description="Charger status will appear when sessions are active."
              />
            ) : (
              chargerPagination.paginatedItems.map((row) => (
                <div key={row.chargerId} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{row.chargerId}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <StatusBadge
                      label={row.status}
                      variant={
                        row.status.toUpperCase() === "FAULT"
                          ? "danger"
                          : row.status.toUpperCase() === "ACTIVE"
                            ? "warning"
                            : "success"
                      }
                    />
                    <span className="text-xs text-foreground-muted">{row.outputKw} kW</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <PaginationControls {...chargerPagination} onPrev={chargerPagination.prev} onNext={chargerPagination.next} />
        </article>
      </section>
    </>
  );
}
