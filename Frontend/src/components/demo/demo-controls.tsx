"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { StatusBadge } from "@/components/ui/status-badge";
import { queryKeys } from "@/constants/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { useAppMutation } from "@/lib/query";
import { demoService, type DemoScenarioName } from "@/services/demo.service";
import { simulationService } from "@/services/simulation.service";
import { useNotificationStore } from "@/store/notification-store";
import { useUiStore } from "@/store/ui-store";
import type { AppRole } from "@/types/user";
import { useAppQuery } from "@/lib/query";

const DEMO_OPERATOR_ROLES: AppRole[] = [
  "ADMIN",
  "A2_OPERATOR",
  "STATION_OPERATOR",
  "EEU_OPERATOR",
];

const SCENARIOS: Array<{ key: DemoScenarioName; label: string; description: string }> = [
  {
    key: "morning-operations",
    label: "Morning Operations",
    description: "Starts normal demand, dispatch, and swap ramp-up.",
  },
  {
    key: "station-congestion",
    label: "Station Congestion",
    description: "Simulates queue growth and high station utilization.",
  },
  {
    key: "charger-fault",
    label: "Charger Fault",
    description: "Injects charger faults and operational alerts.",
  },
  {
    key: "refrigerated-priority-load",
    label: "Refrigerated Priority Load",
    description: "Prioritizes refrigerated freight and cooling demand.",
  },
];

type ConfirmAction =
  | { type: "scenario"; scenario: DemoScenarioName; label: string }
  | { type: "seed" }
  | { type: "reset" }
  | { type: "reset-simulation" }
  | { type: "start-simulation" }
  | { type: "stop-simulation" }
  | null;

export function DemoControls() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isOperator = role ? DEMO_OPERATOR_ROLES.includes(role) : false;
  const isAdmin = role === "ADMIN";

  const [open, setOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);

  const liveUpdatesEnabled = useUiStore((state) => state.liveUpdatesEnabled);
  const setLiveUpdatesEnabled = useUiStore((state) => state.setLiveUpdatesEnabled);
  const lastLiveSyncAt = useUiStore((state) => state.lastLiveSyncAt);

  const notifySuccess = useNotificationStore((state) => state.success);
  const notifyError = useNotificationStore((state) => state.error);

  const seedMutation = useAppMutation(demoService.seed);
  const resetMutation = useAppMutation(demoService.reset);
  const scenarioMutation = useAppMutation(demoService.triggerScenario);
  const startSimulationMutation = useAppMutation(simulationService.start);
  const stopSimulationMutation = useAppMutation(simulationService.stop);
  const resetSimulationMutation = useAppMutation(simulationService.reset);
  const simulationStatusQuery = useAppQuery({
    queryKey: queryKeys.simulation.status,
    queryFn: simulationService.status,
    staleTime: 2_000,
    refetchInterval: 4_000,
  });

  if (!isOperator) return null;

  async function onConfirmAction() {
    if (!pendingAction) return;
    try {
      if (pendingAction.type === "seed") {
        await seedMutation.mutateAsync(undefined);
        notifySuccess("Demo seed executed.");
      } else if (pendingAction.type === "reset") {
        await resetMutation.mutateAsync(undefined);
        notifySuccess("Demo reset executed.");
      } else if (pendingAction.type === "reset-simulation") {
        await resetSimulationMutation.mutateAsync(undefined);
        notifySuccess("Simulation data reset. Fresh batteries, swaps, and revenue created.");
        await simulationStatusQuery.refetch();
        queryClient.invalidateQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            (q.queryKey[0] === "dashboard" || q.queryKey[0] === "batteries"),
        });
      } else if (pendingAction.type === "start-simulation") {
        await startSimulationMutation.mutateAsync(undefined);
        notifySuccess("Global simulation started.");
        await simulationStatusQuery.refetch();
      } else if (pendingAction.type === "stop-simulation") {
        await stopSimulationMutation.mutateAsync(undefined);
        notifySuccess("Global simulation stopped.");
        await simulationStatusQuery.refetch();
      } else {
        await scenarioMutation.mutateAsync(pendingAction.scenario);
        notifySuccess(`Scenario "${pendingAction.label}" started.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Demo action failed.";
      notifyError(message);
    } finally {
      setPendingAction(null);
    }
  }

  const isConfirming =
    seedMutation.isPending ||
    resetMutation.isPending ||
    resetSimulationMutation.isPending ||
    scenarioMutation.isPending ||
    startSimulationMutation.isPending ||
    stopSimulationMutation.isPending;

  return (
    <div className="relative">
      <AsyncActionButton
        label={open ? "Hide Demo" : "Demo Controls"}
        onClick={() => setOpen((value) => !value)}
        variant="outline"
      />

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[360px] rounded-2xl border border-border-subtle bg-background-elevated p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Stakeholder Demo</p>
            <StatusBadge label={isAdmin ? "Admin" : "Operator"} variant="info" />
          </div>

          <LiveRefreshIndicator
            isLive={liveUpdatesEnabled}
            isRefreshing={isConfirming}
            lastSyncAt={lastLiveSyncAt}
            compact
          />

          <label className="mt-3 flex items-center justify-between rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-xs text-foreground-muted">
            <span>Live updates</span>
            <input
              type="checkbox"
              checked={liveUpdatesEnabled}
              onChange={(event) => setLiveUpdatesEnabled(event.target.checked)}
            />
          </label>

          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-border-subtle bg-background-muted px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Global Simulation Engine</p>
                <StatusBadge
                  label={simulationStatusQuery.data?.running ? "Running" : "Stopped"}
                  variant={simulationStatusQuery.data?.running ? "success" : "neutral"}
                />
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                Start once to drive all dashboards together (A2, station, driver, fleet, freight, EEU).
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <AsyncActionButton
                  label="Start All"
                  loading={startSimulationMutation.isPending}
                  loadingLabel="Starting..."
                  onClick={() => setPendingAction({ type: "start-simulation" })}
                />
                <AsyncActionButton
                  label="Stop All"
                  variant="danger"
                  loading={stopSimulationMutation.isPending}
                  loadingLabel="Stopping..."
                  onClick={() => setPendingAction({ type: "stop-simulation" })}
                />
                <AsyncActionButton
                  label="Reset Simulation Data"
                  variant="outline"
                  loading={resetSimulationMutation.isPending}
                  loadingLabel="Resetting..."
                  onClick={() => setPendingAction({ type: "reset-simulation" })}
                  className="col-span-2"
                />
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                Use &quot;Reset Simulation Data&quot; if you see old values (0 batteries ready, low revenue) — it clears sim data and runs bootstrap to create fresh data.
              </p>
            </div>

            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.key}
                type="button"
                onClick={() =>
                  setPendingAction({
                    type: "scenario",
                    scenario: scenario.key,
                    label: scenario.label,
                  })
                }
                className="w-full rounded-xl border border-border-subtle bg-background-muted px-3 py-2 text-left transition hover:border-accent/50"
              >
                <p className="text-sm font-medium text-foreground">{scenario.label}</p>
                <p className="mt-0.5 text-xs text-foreground-muted">{scenario.description}</p>
              </button>
            ))}
          </div>

          {isAdmin ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AsyncActionButton
                label="Seed Demo Data"
                onClick={() => setPendingAction({ type: "seed" })}
                loading={seedMutation.isPending}
                loadingLabel="Seeding..."
              />
              <AsyncActionButton
                label="Reset Demo"
                onClick={() => setPendingAction({ type: "reset" })}
                loading={resetMutation.isPending}
                loadingLabel="Resetting..."
                variant="danger"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(pendingAction)}
        title="Confirm Demo Action"
        message={
          pendingAction?.type === "scenario"
            ? `Trigger scenario "${pendingAction.label}" now?`
            : pendingAction?.type === "seed"
              ? "Seed demo data now?"
              : pendingAction?.type === "reset-simulation"
                ? "Reset simulation data (batteries, swaps, revenue) and run bootstrap to create fresh data? Use this when you see 0 batteries ready or low revenue after applying fixes."
                : pendingAction?.type === "start-simulation"
                  ? "Start the global simulation engine across all dashboards now?"
                  : pendingAction?.type === "stop-simulation"
                    ? "Stop the global simulation engine now?"
                    : "Reset the demo state now?"
        }
        onCancel={() => setPendingAction(null)}
        onConfirm={onConfirmAction}
        confirmLabel="Run Action"
        confirming={isConfirming}
      />
    </div>
  );
}
