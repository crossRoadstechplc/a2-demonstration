"use client";

import { cn } from "@/lib/utils";
import type { Receipt } from "@/types/receipt";
import { billingService, PAYMENT_METHODS } from "@/services/billing.service";

interface PaymentModalProps {
  open: boolean;
  receipt: Receipt | null;
  onClose: () => void;
  onPaid: () => void;
  onToast: (message: string) => void;
  isPaying?: boolean;
  setIsPaying?: (v: boolean) => void;
}

export function PaymentModal({
  open,
  receipt,
  onClose,
  onPaid,
  onToast,
  isPaying = false,
  setIsPaying,
}: PaymentModalProps) {
  if (!open) return null;

  async function handlePayment(method: string) {
    if (!receipt || isPaying) return;
    setIsPaying?.(true);
    onToast("Redirecting to payment gateway...");
    onClose();

    try {
      await billingService.payReceipt(receipt.id, method);
      onPaid();
    } catch {
      onToast("Payment simulation completed.");
    } finally {
      setIsPaying?.(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="panel w-full max-w-md p-5">
        <h3 className="text-lg font-semibold text-foreground">Select payment method</h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Pay {receipt ? Math.round(receipt.total).toLocaleString() : "—"} ETB for this receipt
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => handlePayment(method)}
              disabled={isPaying}
              className="rounded-xl border border-border-subtle bg-background-muted px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent/10 hover:text-accent disabled:opacity-50"
            >
              {method}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border-subtle bg-background px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
