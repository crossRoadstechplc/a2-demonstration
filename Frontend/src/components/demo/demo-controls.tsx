"use client";

import { useState } from "react";

import { AsyncActionButton } from "@/components/ui/async-action-button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { LiveRefreshIndicator } from "@/components/ui/live-refresh-indicator";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useAppMutation } from "@/lib/query";
import { demoService, type DemoScenarioName } from "@/services/demo.service";
import { useNotificationStore } from "@/store/notification-store";
import { useUiStore } from "@/store/ui-store";
import type { AppRole } from "@/types/user";

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
  | null;

export function DemoControls() {
  const { role } = useAuth();
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
    seedMutation.isPending || resetMutation.isPending || scenarioMutation.isPending;

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
