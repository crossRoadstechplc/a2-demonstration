"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notification-store";

interface EeuPaymentNotificationsProps {
  billingSummaryEeu: {
    totalEnergyKwh?: number;
    totalEeuShareEtb?: number;
    totalRevenueEtb?: number;
    totalVatEtb?: number;
    totalReceipts?: number;
    averageEnergyPerTransaction?: number;
  } | null | undefined;
}

export function EeuPaymentNotifications({
  billingSummaryEeu,
}: EeuPaymentNotificationsProps) {
  const previousValuesRef = useRef<{
    totalEnergyKwh: number;
    totalEeuShareEtb: number;
  }>({
    totalEnergyKwh: 0,
    totalEeuShareEtb: 0,
  });
  const { success, info } = useNotificationStore();

  useEffect(() => {
    if (!billingSummaryEeu) return;

    const currentEnergyKwh = billingSummaryEeu.totalEnergyKwh ?? 0;
    const currentEeuShareEtb = billingSummaryEeu.totalEeuShareEtb ?? 0;
    const previousEnergyKwh = previousValuesRef.current.totalEnergyKwh;
    const previousEeuShareEtb = previousValuesRef.current.totalEeuShareEtb;

    // Check for new electricity delivered
    if (currentEnergyKwh > previousEnergyKwh && previousEnergyKwh > 0) {
      const delta = currentEnergyKwh - previousEnergyKwh;
      success(
        `Electricity Delivered: ${Math.round(delta).toLocaleString()} kWh\nTotal: ${Math.round(currentEnergyKwh).toLocaleString()} kWh`,
        "New Energy Delivery"
      );
    }

    // Check for new EEU revenue share
    if (currentEeuShareEtb > previousEeuShareEtb && previousEeuShareEtb > 0) {
      const delta = currentEeuShareEtb - previousEeuShareEtb;
      info(
        `EEU Revenue Share: ${Math.round(delta).toLocaleString()} ETB\nTotal: ${Math.round(currentEeuShareEtb).toLocaleString()} ETB`,
        "Revenue Update"
      );
    }

    // Update previous values
    previousValuesRef.current = {
      totalEnergyKwh: currentEnergyKwh,
      totalEeuShareEtb: currentEeuShareEtb,
    };
  }, [billingSummaryEeu, success, info]);

  return null; // This component doesn't render anything
}
