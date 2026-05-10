import { Badge } from "@/components/ui/badge";
import type { OpenOrder } from "@/lib/data/open-orders";
import { ON_TRACK_META } from "@/lib/data/open-orders";
import { formatNumber } from "@/lib/utils";

/**
 * Mirrors the columns + visual hierarchy of the weekly Open Order Status PDF
 * the customer success team sends every Friday. Same data shape; different
 * presentation surface.
 *
 * Desktop: a wide table tuned so Current Status gets the room it needs.
 * Mobile: each order renders as a stacked card so long status notes don't
 *         distort row heights when columns overflow.
 */
export function OpenOrdersReport({
  orders,
  reportDate,
  customerName,
  salesRep,
  accountManager,
}: {
  orders: OpenOrder[];
  reportDate: string;
  customerName: string;
  salesRep: string;
  accountManager: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-card)]">
      {/* Title banner — same purple heading the PDF report uses */}
      <div className="bg-primary text-primary-foreground px-4 sm:px-5 py-3 sm:py-3.5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-display text-[17px] sm:text-[20px] leading-tight">
            {customerName} — Customer Supplied Label
          </h3>
          <div className="text-[11px] sm:text-xs opacity-90 tabular-nums">
            Sales Rep: {salesRep} · Account Manager: {accountManager}
          </div>
        </div>
      </div>
      <div className="bg-primary/15 text-primary px-4 sm:px-5 py-1.5 text-[12px] sm:text-[13px] font-semibold tracking-tight">
        Open Order Status: {reportDate}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse table-fixed">
          {/* PO# / Sales Order / Product / Type / Qty / Label / Approval / In-House / Est. Ship / Current Status */}
          <colgroup>
            <col className="w-[88px]" />
            <col className="w-[88px]" />
            <col className="w-[180px]" />
            <col className="w-[78px]" />
            <col className="w-[78px]" />
            <col className="w-[88px]" />
            <col className="w-[88px]" />
            <col className="w-[92px]" />
            <col className="w-[78px]" />
            <col />
          </colgroup>
          <thead className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 font-semibold">PO #</th>
              <th className="px-2 py-2.5 font-semibold">Sales Order</th>
              <th className="px-3 py-2.5 font-semibold">Product</th>
              <th className="px-2 py-2.5 font-semibold">Type</th>
              <th className="px-2 py-2.5 font-semibold text-right">Qty</th>
              <th className="px-2 py-2.5 font-semibold">Label</th>
              <th className="px-2 py-2.5 font-semibold">Approval</th>
              <th className="px-2 py-2.5 font-semibold">In-House</th>
              <th className="px-2 py-2.5 font-semibold">Est. Ship</th>
              <th className="px-4 py-2.5 font-semibold">Current Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const meta = ON_TRACK_META[o.onTrack];
              return (
                <tr
                  key={o.id}
                  className="border-b border-border last:border-b-0 align-top hover:bg-accent/40 transition-colors"
                >
                  <td className="px-3 py-3 font-mono text-[11px] text-foreground-soft">
                    {o.poNumber}
                  </td>
                  <td className="px-2 py-3 font-mono text-[11px] text-muted">
                    {o.salesOrder}
                  </td>
                  <td className="px-3 py-3 text-[13px] font-medium text-foreground leading-snug">
                    {o.productName}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-foreground-soft">{o.type}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-[12.5px]">
                    {formatNumber(o.quantity)}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-foreground-soft">
                    {o.labelStatus}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-foreground-soft tabular-nums">
                    {o.labelApprovalDeadline}
                  </td>
                  <td className="px-2 py-3 text-[12px] text-foreground-soft tabular-nums">
                    {o.labelInhouseDeadline}
                    {o.rawMaterialInhouseDeadline && (
                      <div className="text-[10.5px] text-muted mt-0.5">
                        Raw: {o.rawMaterialInhouseDeadline}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[12.5px] tabular-nums font-medium">
                    {o.estimatedShipDate}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <p className="mt-1.5 text-[13px] text-foreground-soft leading-snug">
                      {o.currentStatus}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="md:hidden divide-y divide-border">
        {orders.map(o => {
          const meta = ON_TRACK_META[o.onTrack];
          return (
            <li key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="font-mono text-[11px] text-muted">{o.poNumber}</span>
                  <span className="font-mono text-[11px] text-muted">· {o.salesOrder}</span>
                </div>
                <span className="text-[11px] text-muted tabular-nums">
                  Ship {o.estimatedShipDate}
                </span>
              </div>
              <h4 className="mt-1.5 text-sm font-semibold text-foreground leading-snug">
                {o.productName}
              </h4>
              <div className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[12px] text-muted">
                <div>
                  <div className="text-[10px] uppercase tracking-wide">Type</div>
                  <div className="text-foreground-soft">{o.type}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide">Qty</div>
                  <div className="text-foreground-soft tabular-nums">{formatNumber(o.quantity)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide">Label</div>
                  <div className="text-foreground-soft">{o.labelStatus}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide">Approval</div>
                  <div className="text-foreground-soft tabular-nums">{o.labelApprovalDeadline}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] uppercase tracking-wide">In-House</div>
                  <div className="text-foreground-soft tabular-nums">
                    {o.labelInhouseDeadline}
                    {o.rawMaterialInhouseDeadline && ` · Raw ${o.rawMaterialInhouseDeadline}`}
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-[13px] text-foreground-soft leading-snug">
                {o.currentStatus}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
