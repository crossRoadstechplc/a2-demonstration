/**
 * Finance Phase
 * 
 * Handles financial operations:
 * - Receipt generation for swaps
 * - A2 share calculation
 * - EEU share calculation
 * - VAT calculation
 * - Fleet cost updates
 * - Station revenue updates
 */

import { allQuery, getQuery, runQuery } from "../../../database/connection";
import type { SimulationContext } from "../types";
import { randomInt, round2 } from "../utils";

export async function runFinancePhase(context: SimulationContext): Promise<void> {
  const { timestamp } = context;

  // Find swaps without receipts
  const swapsWithoutReceipts = await allQuery<{
    id: number;
    energyDeliveredKwh: number;
    timestamp: string;
  }>(
    `
    SELECT st.id, st.energyDeliveredKwh, st.timestamp
    FROM swap_transactions st
    LEFT JOIN receipts r ON r.swapId = st.id
    WHERE r.id IS NULL;
    `
  );

  // Create receipts for all swaps without receipts
  for (const swap of swapsWithoutReceipts) {
    await createReceipt(swap.id, swap.energyDeliveredKwh, swap.timestamp || timestamp);
  }
}

async function createReceipt(swapId: number, energyKwh: number, timestamp: string): Promise<void> {
  // Get tariff configuration
  const tariff =
    (await getQuery<{ eeuRatePerKwh: number; a2ServiceRatePerKwh: number; vatPercent: number }>(
      "SELECT eeuRatePerKwh, a2ServiceRatePerKwh, vatPercent FROM tariff_config WHERE id = 1;"
    )) ?? { eeuRatePerKwh: 10, a2ServiceRatePerKwh: 10, vatPercent: 15 };

  // Calculate charges
  // Energy charge = energy delivered (kWh) * EEU rate per kWh
  const energyCharge = round2(energyKwh * tariff.eeuRatePerKwh);
  
  // Service charge = energy delivered (kWh) * A2 service rate per kWh
  const serviceCharge = round2(energyKwh * tariff.a2ServiceRatePerKwh);
  
  // Subtotal = energy charge + service charge
  const subtotal = round2(energyCharge + serviceCharge);
  
  // VAT = subtotal * (VAT percent / 100)
  const vat = round2(subtotal * (tariff.vatPercent / 100));
  
  // Total = subtotal + VAT
  const total = round2(subtotal + vat);
  
  // Share calculations: VAT is split 50/50 between EEU and A2
  // EEU share = energy charge + (VAT / 2)
  const eeuShare = round2(energyCharge + vat / 2);
  
  // A2 share = service charge + (VAT / 2)
  const a2Share = round2(serviceCharge + vat / 2);

  // Random payment method
  const paymentMethods = ["Telebirr", "CBE", "M-Pesa", "Bank Transfer"];
  const paymentMethod = paymentMethods[randomInt(paymentMethods.length)];

  // Verify: total should equal energyCharge + serviceCharge + vat
  // Verify: total should equal eeuShare + a2Share
  const calculatedTotal = round2(energyCharge + serviceCharge + vat);
  const calculatedTotalFromShares = round2(eeuShare + a2Share);
  
  if (Math.abs(total - calculatedTotal) > 0.01) {
    console.warn(`Receipt total mismatch: ${total} vs ${calculatedTotal} for swap ${swapId}`);
  }
  if (Math.abs(total - calculatedTotalFromShares) > 0.01) {
    console.warn(`Receipt total from shares mismatch: ${total} vs ${calculatedTotalFromShares} for swap ${swapId}`);
  }

  // Insert receipt with all required fields
  // Note: subtotal is not stored in DB but can be calculated as energyCharge + serviceCharge
  await runQuery(
    `
    INSERT INTO receipts
    (swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, paymentMethod, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
    [swapId, energyKwh, energyCharge, serviceCharge, vat, total, eeuShare, a2Share, paymentMethod, timestamp]
  );
}
