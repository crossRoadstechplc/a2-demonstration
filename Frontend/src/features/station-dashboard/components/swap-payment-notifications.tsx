"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notification-store";
import { billingService } from "@/services/billing.service";
import type { SwapTransaction } from "@/types/swap";
import type { Receipt } from "@/types/receipt";

interface SwapPaymentNotificationsProps {
  swaps: SwapTransaction[];
  stationId: number;
}

export function SwapPaymentNotifications({
  swaps,
  stationId,
}: SwapPaymentNotificationsProps) {
  const previousSwapIdsRef = useRef<Set<number>>(new Set());
  const { success } = useNotificationStore();

  useEffect(() => {
    // Get latest swaps for this station
    const stationSwaps = swaps.filter((swap) => swap.stationId === stationId);
    const currentSwapIds = new Set(stationSwaps.map((swap) => swap.id));
    
    // Find new swaps
    const newSwaps = stationSwaps.filter(
      (swap) => !previousSwapIdsRef.current.has(swap.id)
    );

    // Show notifications for new swaps
    if (newSwaps.length > 0) {
      billingService.receipts().then((receipts: Receipt[]) => {
        for (const swap of newSwaps) {
          const receipt = receipts.find((r) => r.swapId === swap.id);
          const incomingBatteryId = swap.incomingBatteryId ?? "N/A";
          const outgoingBatteryId = swap.outgoingBatteryId ?? "N/A";
          
          if (receipt) {
            const paymentMethod = receipt.paymentMethod ?? "Unknown";
            success(
              `Payment: ${Math.round(receipt.total).toLocaleString()} ETB via ${paymentMethod}\nBattery: BAT-${incomingBatteryId} → BAT-${outgoingBatteryId}`,
              "Swap Payment"
            );
          } else {
            // Fallback notification
            success(
              `Swap: Truck ${swap.truckId} | Energy: ${Math.round(swap.energyDeliveredKwh)} kWh\nBattery: BAT-${incomingBatteryId} → BAT-${outgoingBatteryId}`,
              "Battery Swap"
            );
          }
        }
      }).catch(() => {
        // Fallback notifications if receipt fetch fails
        for (const swap of newSwaps) {
          // Handle both camelCase and snake_case field names
          const incomingBatteryId = (swap as any).incomingBatteryId ?? (swap as any).incoming_battery_id ?? "N/A";
          const outgoingBatteryId = (swap as any).outgoingBatteryId ?? (swap as any).outgoing_battery_id ?? "N/A";
          const batteryInfo = incomingBatteryId !== "N/A" && outgoingBatteryId !== "N/A"
            ? `Battery: BAT-${incomingBatteryId} → BAT-${outgoingBatteryId}`
            : "";
          success(
            `Swap: Truck ${swap.truckId} | Energy: ${Math.round(swap.energyDeliveredKwh)} kWh${batteryInfo ? `\n${batteryInfo}` : ""}`,
            "Battery Swap"
          );
        }
      });
    }

    // Update previous swap IDs
    previousSwapIdsRef.current = currentSwapIds;
  }, [swaps, stationId, success]);

  return null; // This component doesn't render anything
}
