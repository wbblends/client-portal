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
      <div className="bg-primary text-primary-foreground px-5 py-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="font-display text-2xl leading-tight">
            {customerName} — Customer Supplied Label
          </h3>
          <div className="text-sm opacity-95 tabular-nums">
            Sales Rep: {salesRep} · Account Manager: {accountManager}
          </div>
        </div>
      </div>
      <div className="bg-primary/15 text-primary px-5 py-2 text-sm font-bold tracking-tight">
        Open Order Status: {reportDate}
      </div>

      {/* Desktop table — auto-width columns now that text is larger; horizontal
          scroll handles the wider total. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-base border-collapse min-w-[1100px]">
          <thead className="text-left text-xs font-bold uppercase tracking-wide text-muted">
            <tr className="border-b-2 border-border-strong">
              <th className="px-3 py-3">PO #</th>
              <th className="px-2 py-3">Sales Order</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-2 py-3">Type</th>
              <th className="px-2 py-3 text-right">Qty</th>
              <th className="px-2 py-3">Label</th>
              <th className="px-2 py-3">Approval</th>
              <th className="px-2 py-3">In-House</th>
              <th className="px-2 py-3">Est. Ship</th>
              <th className="px-4 py-3">Current Status</th>
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
                  <td className="px-3 py-4 font-mono text-sm text-foreground-soft">
                    {o.poNumber}
                  </td>
                  <td className="px-2 py-4 font-mono text-sm text-muted">
                    {o.salesOrder}
                  </td>
                  <td className="px-3 py-4 font-semibold text-foreground leading-snug min-w-[200px]">
                    {o.productName}
                  </td>
                  <td className="px-2 py-4 text-foreground-soft">{o.type}</td>
                  <td className="px-2 py-4 text-right tabular-nums">
                    {formatNumber(o.quantity)}
                  </td>
                  <td className="px-2 py-4 text-foreground-soft">
                    {o.labelStatus}
                  </td>
                  <td className="px-2 py-4 text-foreground-soft tabular-nums">
                    {o.labelApprovalDeadline}
                  </td>
                  <td className="px-2 py-4 text-foreground-soft tabular-nums">
                    {o.labelInhouseDeadline}
                    {o.rawMaterialInhouseDeadline && (
                      <div className="text-sm text-muted mt-1">
                        Raw: {o.rawMaterialInhouseDeadline}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-4 tabular-nums font-semibold">
                    {o.estimatedShipDate}
                  </td>
                  <td className="px-4 py-4 min-w-[260px]">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <p className="mt-2 text-base text-foreground-soft leading-relaxed">
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
            <li key={o.id} className="p-5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="font-mono text-sm text-muted">{o.poNumber}</span>
                  <span className="font-mono text-sm text-muted">· {o.salesOrder}</span>
                </div>
                <span className="text-sm text-muted tabular-nums">
                  Ship {o.estimatedShipDate}
                </span>
              </div>
              <h4 className="mt-2 text-base font-bold text-foreground leading-snug">
                {o.productName}
              </h4>
              <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3 text-base text-muted">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide">Type</div>
                  <div className="text-foreground-soft mt-0.5">{o.type}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide">Qty</div>
                  <div className="text-foreground-soft tabular-nums mt-0.5">{formatNumber(o.quantity)}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide">Label</div>
                  <div className="text-foreground-soft mt-0.5">{o.labelStatus}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide">Approval</div>
                  <div className="text-foreground-soft tabular-nums mt-0.5">{o.labelApprovalDeadline}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wide">In-House</div>
                  <div className="text-foreground-soft tabular-nums mt-0.5">
                    {o.labelInhouseDeadline}
                    {o.rawMaterialInhouseDeadline && ` · Raw ${o.rawMaterialInhouseDeadline}`}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-base text-foreground-soft leading-relaxed">
                {o.currentStatus}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
