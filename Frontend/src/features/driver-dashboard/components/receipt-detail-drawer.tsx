"use client";

import { DetailDrawer } from "@/components/ui/detail-drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Receipt } from "@/types/receipt";

interface ReceiptDetailDrawerProps {
  receipt: Receipt | null;
  open: boolean;
  onClose: () => void;
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
}

export function ReceiptDetailDrawer({
  receipt,
  open,
  onClose,
}: ReceiptDetailDrawerProps) {
  if (!receipt) return null;

  const isPaid = String(receipt.status ?? "").toUpperCase() === "PAID";

  return (
    <DetailDrawer
      open={open}
      title={`Receipt #${receipt.id}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-muted">Status</span>
          <StatusBadge
            label={isPaid ? "Paid" : "Pending"}
            variant={isPaid ? "success" : "warning"}
            size="md"
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-background-muted p-4">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Transaction
          </p>
          <p className="mt-1 text-sm text-foreground">Swap #{receipt.swapId}</p>
          <p className="text-xs text-foreground-muted">
            {formatDate(receipt.timestamp)}
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-background-muted p-4 space-y-2">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Energy
          </p>
          <p className="text-lg font-semibold text-foreground">
            {Math.round(receipt.energyKwh)} kWh
          </p>
        </div>

        <div className="rounded-xl border border-border-subtle bg-background-muted p-4 space-y-3">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Charges
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Energy charge</span>
              <span className="font-medium text-foreground">
                {Math.round(receipt.energyCharge).toLocaleString()} ETB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Service charge</span>
              <span className="font-medium text-foreground">
                {Math.round(receipt.serviceCharge).toLocaleString()} ETB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">VAT (15%)</span>
              <span className="font-medium text-foreground">
                {Math.round(receipt.vat).toLocaleString()} ETB
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border-2 border-accent/50 bg-accent/5 p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-xl font-bold text-accent">
              {Math.round(receipt.total).toLocaleString()} ETB
            </span>
          </div>
        </div>

        {receipt.paymentMethod ? (
          <div className="rounded-xl border border-border-subtle bg-background-muted p-4">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Payment method
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {receipt.paymentMethod}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-border-subtle bg-background-muted p-4 space-y-2">
          <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Revenue split
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">A2 share</span>
            <span>{Math.round(receipt.a2Share).toLocaleString()} ETB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground-muted">EEU share</span>
            <span>{Math.round(receipt.eeuShare).toLocaleString()} ETB</span>
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}
