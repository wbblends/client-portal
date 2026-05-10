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
      <div className="px-5 py-12 text-center text-base text-muted">
        No orders in this date range.
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base">
          <thead className="text-left text-xs font-bold uppercase tracking-wide text-muted">
            <tr className="border-b-2 border-border-strong">
              <th className="px-5 py-3">SKU</th>
              <th className="px-3 py-3 text-right">Units</th>
              <th className="px-3 py-3 text-right">Value</th>
              <th className="px-3 py-3 border-l border-border">Last Order</th>
              <th className="px-3 py-3">Cadence</th>
              <th className="px-5 py-3">Order Window</th>
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
                  <td className="px-5 py-4">
                    <div className="font-mono text-sm text-muted">{row.sku}</div>
                    <div className="font-semibold text-foreground">{row.skuName}</div>
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">
                    {formatNumber(roundToHalfK(row.units))}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums font-semibold">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-3 py-4 border-l border-border whitespace-nowrap">
                    <div className="text-foreground-soft tabular-nums">
                      {cadence?.lastOrder ?? formatDate(row.lastOrderDate, "short")}
                    </div>
                    <div className="text-sm text-muted mt-1">
                      Latest <Badge tone={meta.tone as BadgeTone} className="ml-0.5">{meta.label}</Badge>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-foreground-soft whitespace-nowrap">
                    {cadence?.cadence ?? "—"}
                  </td>
                  <td className="px-5 py-4">
                    {cadence ? (
                      <Badge tone={windowTone as BadgeTone}>{cadence.windowLabel}</Badge>
                    ) : (
                      <span className="text-sm text-muted">—</span>
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
            <li key={row.sku} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-foreground">{row.skuName}</div>
                  <div className="font-mono text-sm text-muted">{row.sku}</div>
                </div>
                {cadence && (
                  <Badge tone={windowTone as BadgeTone}>{cadence.windowLabel}</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-base">
                <div>
                  <div className="text-xs uppercase tracking-wide font-bold text-muted">Units</div>
                  <div className="tabular-nums font-semibold text-foreground mt-0.5">
                    {formatNumber(roundToHalfK(row.units))}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide font-bold text-muted">Value</div>
                  <div className="tabular-nums font-semibold text-foreground mt-0.5">
                    {formatCurrency(row.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide font-bold text-muted">Last Order</div>
                  <div className="tabular-nums text-foreground-soft mt-0.5">
                    {cadence?.lastOrder ?? formatDate(row.lastOrderDate, "short")}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide font-bold text-muted">Cadence</div>
                  <div className="text-foreground-soft mt-0.5">{cadence?.cadence ?? "—"}</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-muted">
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
