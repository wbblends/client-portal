import type { OrderLine } from "./types";

export type SalesProductRow = {
  sku: string;
  name: string;
  annualUnits: number;
  annualDollars: number;
  currentUnits: number;
  currentDollars: number;
  previousUnits: number;
  previousDollars: number;
};

/**
 * Build the Sales By Product table. Picks the top N products by annual
 * (trailing-365-day) dollar volume; per-row columns adapt to the selected
 * window and its compare window.
 */
export function buildSalesByProduct(
  allOrders: OrderLine[],
  current: { from: Date; to: Date },
  compare: { from: Date; to: Date },
  topN = 5,
): SalesProductRow[] {
  const today = new Date();
  const annualFrom = new Date(today);
  annualFrom.setFullYear(annualFrom.getFullYear() - 1);

  type Acc = SalesProductRow;
  const map = new Map<string, Acc>();

  for (const o of allOrders) {
    if (o.status === "canceled") continue;
    const t = o.orderDate.getTime();
    const inAnnual = t >= annualFrom.getTime() && t <= today.getTime();
    const inCurrent = t >= current.from.getTime() && t <= current.to.getTime();
    const inCompare = t >= compare.from.getTime() && t <= compare.to.getTime();

    if (!inAnnual && !inCurrent && !inCompare) continue;

    let row = map.get(o.sku);
    if (!row) {
      row = {
        sku: o.sku,
        name: o.skuName,
        annualUnits: 0,
        annualDollars: 0,
        currentUnits: 0,
        currentDollars: 0,
        previousUnits: 0,
        previousDollars: 0,
      };
      map.set(o.sku, row);
    }
    if (inAnnual) {
      row.annualUnits += o.units;
      row.annualDollars += o.amount;
    }
    if (inCurrent) {
      row.currentUnits += o.units;
      row.currentDollars += o.amount;
    }
    if (inCompare) {
      row.previousUnits += o.units;
      row.previousDollars += o.amount;
    }
  }

  return [...map.values()]
    .sort((a, b) => b.annualDollars - a.annualDollars)
    .slice(0, topN);
}
