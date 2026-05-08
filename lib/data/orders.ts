import { seededRng, startOfDay, endOfDay } from "@/lib/utils";
import type { OrderLine, OrderStatus } from "./types";

/**
 * Mock SKU catalog representative of WB Blends botanical/wellness blends.
 * Future: replace with Acumatica InventoryItem pull.
 */
const SKUS: Array<{ sku: string; name: string; category: string; unitPrice: number }> = [
  { sku: "BLD-IMM-100", name: "Immunity Blend (Bulk)", category: "Immunity", unitPrice: 38.5 },
  { sku: "BLD-IMM-25", name: "Immunity Blend (Pail)", category: "Immunity", unitPrice: 41.0 },
  { sku: "BLD-FOC-100", name: "Focus Botanical Blend", category: "Cognitive", unitPrice: 44.25 },
  { sku: "BLD-CLM-100", name: "Calm Adaptogen Blend", category: "Adaptogen", unitPrice: 46.0 },
  { sku: "BLD-CLM-25", name: "Calm Adaptogen Blend (Pail)", category: "Adaptogen", unitPrice: 48.75 },
  { sku: "BLD-ENR-100", name: "Energy Botanical Blend", category: "Energy", unitPrice: 39.5 },
  { sku: "BLD-SLP-100", name: "Sleep Botanical Blend", category: "Sleep", unitPrice: 42.0 },
  { sku: "BLD-DGS-100", name: "Digestive Bitters Blend", category: "Digestive", unitPrice: 35.75 },
  { sku: "BLD-WMN-100", name: "Women's Wellness Blend", category: "Wellness", unitPrice: 47.0 },
  { sku: "BLD-MRT-100", name: "Mushroom Trio Blend", category: "Mushroom", unitPrice: 58.5 },
  { sku: "BLD-MRT-25", name: "Mushroom Trio Blend (Pail)", category: "Mushroom", unitPrice: 61.25 },
  { sku: "RAW-ASH-100", name: "Ashwagandha Root Powder", category: "Adaptogen", unitPrice: 28.0 },
  { sku: "RAW-RHO-50", name: "Rhodiola Extract", category: "Adaptogen", unitPrice: 96.0 },
  { sku: "RAW-LMB-100", name: "Lemon Balm Powder", category: "Calm", unitPrice: 19.5 },
];

const STATUS_FLOW: OrderStatus[] = [
  "open",
  "in_production",
  "shipped",
  "delivered",
];

function pickStatus(rng: () => number, daysSinceOrder: number, dueIn: number): OrderStatus {
  // Recently placed -> open / in_production. Past promise date and not delivered -> delayed (rare).
  if (daysSinceOrder < 5) return rng() < 0.5 ? "open" : "in_production";
  if (daysSinceOrder < 14) return rng() < 0.55 ? "in_production" : "shipped";
  if (daysSinceOrder < 30) {
    if (dueIn < -2 && rng() < 0.10) return "delayed";
    return rng() < 0.35 ? "shipped" : "delivered";
  }
  // Older orders: mostly delivered, very rare cancel/delay
  const r = rng();
  if (r < 0.92) return "delivered";
  if (r < 0.96) return "shipped";
  if (r < 0.985) return "delayed";
  return "canceled";
}

/**
 * Generates a stable, plausible 18-month order history for a customer. Today is
 * the most recent order date and history extends back to support YoY views.
 *
 * Future: replace with `acumatica.salesOrders.list({ customerId, dateFrom, dateTo })`
 * and a join against the proprietary system for SKU enrichments.
 */
export async function getAllOrders(customerId: string): Promise<OrderLine[]> {
  const rng = seededRng(hashSeed(customerId));
  const lines: OrderLine[] = [];
  const today = new Date();
  const start = new Date(today);
  start.setMonth(start.getMonth() - 18);

  // Generate ~3-5 orders per week with 1-4 lines each.
  const weeks = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
  let orderSeq = 1000;

  for (let w = 0; w < weeks; w++) {
    // Seasonality: more orders Q3/Q4 (back to school + flu season for immunity)
    const weekDate = new Date(start.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const month = weekDate.getMonth();
    const seasonalBoost = month >= 7 && month <= 11 ? 1.4 : 1.0;
    // YoY growth ~12%: ramp newer weeks slightly higher.
    const growth = 1 + 0.12 * (w / weeks);
    const ordersThisWeek = Math.max(1, Math.round((2 + rng() * 3) * seasonalBoost * growth));

    for (let o = 0; o < ordersThisWeek; o++) {
      const orderDate = new Date(weekDate);
      orderDate.setDate(orderDate.getDate() + Math.floor(rng() * 7));
      if (orderDate > today) continue;

      const promisedDate = new Date(orderDate);
      promisedDate.setDate(promisedDate.getDate() + 14 + Math.floor(rng() * 14));

      const lineCount = 1 + Math.floor(rng() * 4);
      const poNumber = `PO-${100000 + orderSeq++}`;

      const usedSkus = new Set<string>();
      for (let i = 0; i < lineCount; i++) {
        let pick = SKUS[Math.floor(rng() * SKUS.length)];
        if (usedSkus.has(pick.sku)) {
          pick = SKUS[(SKUS.indexOf(pick) + 1) % SKUS.length];
        }
        usedSkus.add(pick.sku);

        // Round to nearest 500 so per-SKU aggregates land on clean numbers.
        const units = Math.max(500, Math.round((500 + rng() * 9500) / 500) * 500);
        const unitPrice = pick.unitPrice * (0.96 + rng() * 0.08); // ±4% variation
        const amount = units * unitPrice;

        const daysSinceOrder = Math.floor((today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        const dueIn = Math.floor((promisedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const status = pickStatus(rng, daysSinceOrder, dueIn);

        let shippedDate: Date | null = null;
        let deliveredDate: Date | null = null;
        if (status === "shipped" || status === "delivered" || status === "delayed") {
          shippedDate = new Date(orderDate);
          shippedDate.setDate(shippedDate.getDate() + 8 + Math.floor(rng() * 12));
          if (shippedDate > today) shippedDate = today;
        }
        if (status === "delivered") {
          deliveredDate = new Date((shippedDate ?? orderDate));
          // ~85% on-time. The rest, slightly late.
          const onTime = rng() < 0.87;
          const transitDays = onTime ? 2 + Math.floor(rng() * 4) : 5 + Math.floor(rng() * 7);
          deliveredDate.setDate(deliveredDate.getDate() + transitDays);
          if (deliveredDate > today) deliveredDate = today;
        }

        lines.push({
          id: `${poNumber}-${i + 1}`,
          poNumber,
          orderDate,
          promisedDate,
          shippedDate,
          deliveredDate,
          sku: pick.sku,
          skuName: pick.name,
          category: pick.category,
          units,
          unitPrice: Math.round(unitPrice * 100) / 100,
          amount: Math.round(amount * 100) / 100,
          status,
        });
      }
    }
  }

  return lines;
}

export async function getOrdersInRange(
  customerId: string,
  from: Date,
  to: Date,
): Promise<OrderLine[]> {
  const all = await getAllOrders(customerId);
  const f = startOfDay(from).getTime();
  const t = endOfDay(to).getTime();
  return all.filter(o => {
    const od = o.orderDate.getTime();
    return od >= f && od <= t;
  });
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  open: { label: "Open", tone: "neutral" },
  in_production: { label: "In production", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  delayed: { label: "Delayed", tone: "warning" },
  canceled: { label: "Canceled", tone: "danger" },
};
