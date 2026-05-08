import type { OrderLine } from "./types";

export type Bucketing = "week" | "month";

export type Bucket = {
  key: string; // ISO start of bucket
  label: string;
  start: Date;
  end: Date;
};

export function pickBucketing(from: Date, to: Date): Bucketing {
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  return days <= 75 ? "week" : "month";
}

/** Build buckets covering [from, to] inclusive. */
export function buildBuckets(from: Date, to: Date, mode: Bucketing): Bucket[] {
  const out: Bucket[] = [];
  if (mode === "week") {
    // Align start to the same weekday as `from`.
    let cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= to) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      out.push({
        key: start.toISOString(),
        label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        start,
        end,
      });
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const last = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= last) {
      const start = new Date(cursor);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const sameYear = start.getFullYear() === new Date().getFullYear();
      out.push({
        key: start.toISOString(),
        label: sameYear
          ? start.toLocaleDateString("en-US", { month: "short" })
          : start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        start,
        end,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return out;
}

export function sumOrdersInBucket(orders: OrderLine[], bucket: Bucket): { dollars: number; units: number } {
  let dollars = 0;
  let units = 0;
  for (const o of orders) {
    if (o.status === "canceled") continue;
    const t = o.orderDate.getTime();
    if (t >= bucket.start.getTime() && t <= bucket.end.getTime()) {
      dollars += o.amount;
      units += o.units;
    }
  }
  return { dollars, units };
}

export function sumOrders(orders: OrderLine[]): { dollars: number; units: number; count: number } {
  let dollars = 0;
  let units = 0;
  const pos = new Set<string>();
  for (const o of orders) {
    if (o.status === "canceled") continue;
    dollars += o.amount;
    units += o.units;
    pos.add(o.poNumber);
  }
  return { dollars, units, count: pos.size };
}

/** % change. Returns null if prior is zero. */
export function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}
