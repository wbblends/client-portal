import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ORDER_STATUS_META } from "@/lib/data/orders";
import { CADENCE, WINDOW_TONE } from "@/lib/data/sku-cadence";
import type { OrderLine, OrderStatus } from "@/lib/data/types";
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";

type SkuRow = {
  sku: string;
  skuName: string;
  units: number;
  amount: number;
  lastOrderDate: Date;
  latestStatus: OrderStatus;
};

function aggregate(orders: OrderLine[]): SkuRow[] {
  const map = new Map<string, SkuRow>();
  for (const o of orders) {
    const existing = map.get(o.sku);
    if (existing) {
      existing.units += o.units;
      existing.amount += o.amount;
      if (o.orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = o.orderDate;
        existing.latestStatus = o.status;
      }
    } else {
      map.set(o.sku, {
        sku: o.sku,
        skuName: o.skuName,
        units: o.units,
        amount: o.amount,
        lastOrderDate: o.orderDate,
        latestStatus: o.status,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function SkuGrid({ orders, topN = 7 }: { orders: OrderLine[]; topN?: number }) {
  const rows = aggregate(orders).slice(0, topN);

  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted">
        No orders in this date range.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card text-left text-[11px] font-semibold uppercase tracking-wide text-muted shadow-[0_1px_0_0_var(--color-border)]">
            <tr>
              <th className="px-5 py-2.5 font-semibold">SKU</th>
              <th className="px-3 py-2.5 font-semibold text-right">Units</th>
              <th className="px-3 py-2.5 font-semibold text-right">Value</th>
              <th className="px-3 py-2.5 font-semibold border-l border-border">Last Order</th>
              <th className="px-3 py-2.5 font-semibold">Cadence</th>
              <th className="px-5 py-2.5 font-semibold">Order Window</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const cadence = CADENCE[row.sku];
              const meta = ORDER_STATUS_META[row.latestStatus];
              const windowTone = cadence ? WINDOW_TONE[cadence.windowStatus] : "neutral";
              return (
                <tr
                  key={row.sku}
                  className={cn(
                    "border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors align-top",
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="font-mono text-[12px] text-muted">{row.sku}</div>
                    <div className="font-medium text-foreground">{row.skuName}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatNumber(roundToHalfK(row.units))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-3 py-3 border-l border-border whitespace-nowrap">
                    <div className="text-foreground-soft tabular-nums">
                      {cadence?.lastOrder ?? formatDate(row.lastOrderDate, "short")}
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      Latest <Badge tone={meta.tone as BadgeTone} className="ml-0.5">{meta.label}</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-foreground-soft whitespace-nowrap">
                    {cadence?.cadence ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {cadence ? (
                      <Badge tone={windowTone as BadgeTone}>{cadence.windowLabel}</Badge>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="md:hidden divide-y divide-border">
        {rows.map(row => {
          const cadence = CADENCE[row.sku];
          const meta = ORDER_STATUS_META[row.latestStatus];
          const windowTone = cadence ? WINDOW_TONE[cadence.windowStatus] : "neutral";
          return (
            <li key={row.sku} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{row.skuName}</div>
                  <div className="font-mono text-[11px] text-muted">{row.sku}</div>
                </div>
                {cadence && (
                  <Badge tone={windowTone as BadgeTone}>{cadence.windowLabel}</Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">Units</div>
                  <div className="tabular-nums font-medium text-foreground">
                    {formatNumber(roundToHalfK(row.units))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">Value</div>
                  <div className="tabular-nums font-medium text-foreground">
                    {formatCurrency(row.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">Last Order</div>
                  <div className="tabular-nums text-foreground-soft">
                    {cadence?.lastOrder ?? formatDate(row.lastOrderDate, "short")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted">Cadence</div>
                  <div className="text-foreground-soft">{cadence?.cadence ?? "—"}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted">
                Latest <Badge tone={meta.tone as BadgeTone} className="ml-1">{meta.label}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Display-only rounding so aggregate units present as clean 500 / 1k multiples. */
function roundToHalfK(n: number): number {
  return Math.round(n / 500) * 500;
}
