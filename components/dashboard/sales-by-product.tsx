import type { SalesProductRow } from "@/lib/data/sales-products";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Top N products with three time-buckets side by side: trailing-12-month
 * total, the user's selected window, and the compare window. Only the
 * "current" and "previous" columns move when the date picker changes.
 *
 * Mobile: each product renders as a card with the three windows stacked.
 */
export function SalesByProduct({
  rows,
  currentLabel,
  compareLabel,
}: {
  rows: SalesProductRow[];
  currentLabel: string;
  compareLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted shadow-[var(--shadow-card)]">
        No product activity in the selected window.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th rowSpan={2} className="px-5 pt-3 pb-2 align-bottom font-semibold">
                Product
              </th>
              <th rowSpan={2} className="px-3 pt-3 pb-2 align-bottom font-semibold text-right">
                Annual
              </th>
              <th colSpan={2} className="px-3 pt-3 pb-1 font-semibold border-l border-border">
                {currentLabel}
              </th>
              <th colSpan={2} className="px-3 pt-3 pb-1 font-semibold border-l border-border">
                {compareLabel}
              </th>
            </tr>
            <tr className="border-b border-border">
              <th className="px-3 pb-2 font-semibold text-right text-[10.5px] border-l border-border">
                Units
              </th>
              <th className="px-3 pb-2 font-semibold text-right text-[10.5px]">$</th>
              <th className="px-3 pb-2 font-semibold text-right text-[10.5px] border-l border-border">
                Units
              </th>
              <th className="px-3 pb-2 font-semibold text-right text-[10.5px]">$</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.sku}
                className="border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors"
              >
                <td className="px-5 py-3 align-top">
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="font-mono text-[11px] text-muted mt-0.5">{r.sku}</div>
                </td>
                <td className="px-3 py-3 align-top text-right">
                  <div className="tabular-nums font-medium text-foreground">
                    {formatCurrency(r.annualDollars, { compact: true })}
                  </div>
                  <div className="tabular-nums text-[12px] text-muted mt-0.5">
                    {formatNumber(roundUnits(r.annualUnits))} units
                  </div>
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums text-foreground-soft border-l border-border">
                  {formatNumber(roundUnits(r.currentUnits))}
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums font-medium">
                  {formatCurrency(r.currentDollars)}
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums text-muted border-l border-border">
                  {formatNumber(roundUnits(r.previousUnits))}
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums text-muted">
                  {formatCurrency(r.previousDollars)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="md:hidden divide-y divide-border">
        {rows.map(r => (
          <li key={r.sku} className="p-4">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{r.name}</div>
                <div className="font-mono text-[11px] text-muted">{r.sku}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted">Annual</div>
                <div className="tabular-nums text-sm font-semibold text-foreground">
                  {formatCurrency(r.annualDollars, { compact: true })}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded-md bg-accent/60 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted">{currentLabel}</div>
                <div className="mt-0.5 tabular-nums font-semibold text-foreground">
                  {formatCurrency(r.currentDollars)}
                </div>
                <div className="tabular-nums text-muted">
                  {formatNumber(roundUnits(r.currentUnits))} units
                </div>
              </div>
              <div className="rounded-md bg-accent/30 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-muted">{compareLabel}</div>
                <div className="mt-0.5 tabular-nums text-foreground-soft">
                  {formatCurrency(r.previousDollars)}
                </div>
                <div className="tabular-nums text-muted">
                  {formatNumber(roundUnits(r.previousUnits))} units
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function roundUnits(n: number): number {
  return Math.round(n / 500) * 500;
}
