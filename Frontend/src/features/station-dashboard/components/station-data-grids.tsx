import { EmptyPlaceholder } from "@/components/ui/empty-placeholder";
import { StatusBadge } from "@/components/ui/status-badge";
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
                  batteries.map((battery) => (
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
              <EmptyPlaceholder title="No active charging sessions" />
            ) : (
              chargingSessions.slice(0, 10).map((session, index) => (
                <div
                  key={`${index}`}
                  className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2"
                >
                  <p className="text-sm text-foreground">Session #{index + 1}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Battery {String(session.batteryId ?? "-")} · Status{" "}
                    {String(session.status ?? "ACTIVE")}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">5) Swap Transaction History</p>
          <div className="mt-3 space-y-2">
            {swaps.length === 0 ? (
              <EmptyPlaceholder title="No swap transactions today" />
            ) : (
              swaps.slice(0, 10).map((swap) => (
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
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <article className="panel card-regular">
          <p className="type-label">6) Trucks Currently at Station</p>
          <div className="mt-3 space-y-2">
            {trucksAtStation.length === 0 ? (
              <EmptyPlaceholder title="No trucks currently parked" />
            ) : (
              trucksAtStation.map((truck) => (
                <div key={truck.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{truck.plateNumber}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    SOC {truck.currentSoc}% · {truck.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">7) Incoming Truck Predictions</p>
          <div className="mt-3 space-y-2">
            {predictions.length === 0 ? (
              <EmptyPlaceholder title="No incoming predictions available" />
            ) : (
              predictions.map((item, index) => (
                <div key={`${item.truckLabel}-${index}`} className="rounded-xl border border-border-subtle px-3 py-2">
                  <p className="text-sm text-foreground">{item.truckLabel}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    ETA {item.eta} · Est. SOC {item.estimatedSoc}%
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">8) Charger Operational Status</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chargerRows.length === 0 ? (
              <EmptyPlaceholder title="No charger telemetry available" />
            ) : (
              chargerRows.map((row) => (
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
        </article>
      </section>

      <section className="dashboard-grid grid-cols-1 lg:grid-cols-2">
        <article className="panel card-regular">
          <p className="type-label">9) Station Incidents Panel</p>
          <div className="mt-3 space-y-2">
            {incidents.length === 0 ? (
              <EmptyPlaceholder title="No active incidents" />
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className="rounded-xl border border-border-subtle px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground">{incident.type}</p>
                    <StatusBadge
                      label={incident.severity}
                      variant={
                        incident.severity.toUpperCase() === "HIGH"
                          ? "danger"
                          : incident.severity.toUpperCase() === "MEDIUM"
                            ? "warning"
                            : "info"
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">{incident.message}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="panel card-regular">
          <p className="type-label">10) Queue / Congestion Panel</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs uppercase text-foreground-muted">Queue Alerts</p>
              <p className="mt-1 text-sm text-foreground">
                {incidents.filter((item) => item.type.toUpperCase().includes("QUEUE")).length} active
                queue-related incidents
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs uppercase text-foreground-muted">Open Charger Faults</p>
              <p className="mt-1 text-sm text-foreground">{faults.length} open/active issues</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <p className="text-xs uppercase text-foreground-muted">Queue Severity</p>
              <p className="mt-1 text-sm text-foreground">
                {faults.length + incidents.length > 6 ? "High" : "Moderate"}
              </p>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
