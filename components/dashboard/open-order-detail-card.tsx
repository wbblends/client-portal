import { Badge } from "@/components/ui/badge";
import type { OpenOrder } from "@/lib/data/open-orders";
import { ON_TRACK_META } from "@/lib/data/open-orders";
import { formatNumber } from "@/lib/utils";

/**
 * Detail panel rendered inside a Popover when a row in the Open Orders report
 * is clicked. Reads from the in-memory order; the `getOpenOrderById` loader
 * is the seam for future deep-link / refresh fetches.
 */
export function OpenOrderDetailCard({ order }: { order: OpenOrder }) {
  const meta = ON_TRACK_META[order.onTrack];

  return (
    <div className="flex flex-col max-h-[520px]">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="font-mono">{order.poNumber}</span>
              <span>·</span>
              <span className="font-mono">{order.salesOrder}</span>
            </div>
            <h3 className="mt-1 font-display text-[18px] leading-tight text-foreground truncate">
              {order.productName}
            </h3>
          </div>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-5 py-4 space-y-4">
        {/* Key facts grid */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
          <Field label="Type" value={order.type} />
          <Field label="Quantity" value={formatNumber(order.quantity)} mono />
          <Field label="Est. Ship" value={order.estimatedShipDate} mono />
          <Field label="Production line" value={order.productionLine ?? "—"} />
          <Field label="Label status" value={order.labelStatus} />
          <Field label="Label approval" value={order.labelApprovalDeadline} mono />
          <Field label="Labels in-house" value={order.labelInhouseDeadline} mono />
          {order.rawMaterialInhouseDeadline && (
            <Field label="Raw material in-house" value={order.rawMaterialInhouseDeadline} mono />
          )}
          {order.coaStatus && <Field label="COA status" value={coaLabel(order.coaStatus)} />}
        </dl>

        {/* Current status note */}
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
            Current status
          </div>
          <p className="text-[13px] text-foreground-soft leading-snug">{order.currentStatus}</p>
        </div>

        {/* Timeline */}
        {order.timeline && order.timeline.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-2">
              Timeline
            </div>
            <ol className="space-y-1.5">
              {order.timeline.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px]">
                  <span
                    className={
                      "mt-[5px] inline-block h-1.5 w-1.5 rounded-full flex-none " +
                      (t.complete ? "bg-success" : "bg-border-strong")
                    }
                    aria-hidden
                  />
                  <span className="flex-1 text-foreground-soft">{t.label}</span>
                  <span className="font-mono text-[11px] text-muted tabular-nums">{t.date}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Documents */}
        {order.documents && order.documents.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Documents
            </div>
            <ul className="space-y-1 text-[12.5px]">
              {order.documents.map((d, i) => (
                <li key={i} className="text-foreground-soft truncate">
                  {d.href ? (
                    <a href={d.href} className="text-primary hover:underline">{d.name}</a>
                  ) : (
                    d.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent activity */}
        {order.changelog && order.changelog.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1.5">
              Recent activity
            </div>
            <ul className="space-y-2">
              {order.changelog.slice(0, 3).map((c, i) => (
                <li key={i} className="text-[12.5px]">
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-mono tabular-nums">{c.date}</span>
                    <span>·</span>
                    <span>{c.author}</span>
                  </div>
                  <p className="text-foreground-soft leading-snug mt-0.5">{c.note}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-accent/40 flex items-center justify-between gap-3 text-[11.5px]">
        <div className="text-muted truncate">
          {order.contact ? (
            <>
              Owner:{" "}
              <a className="text-primary hover:underline" href={`mailto:${order.contact.email}`}>
                {order.contact.name}
              </a>
            </>
          ) : (
            <>Owner: —</>
          )}
        </div>
        {order.externalIds?.acumaticaId && (
          <div className="font-mono text-muted-soft truncate">
            {order.externalIds.acumaticaId}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-muted font-semibold">{label}</dt>
      <dd
        className={
          "text-foreground-soft mt-0.5 " + (mono ? "font-mono tabular-nums text-[12px]" : "")
        }
      >
        {value}
      </dd>
    </div>
  );
}

function coaLabel(s: NonNullable<OpenOrder["coaStatus"]>): string {
  switch (s) {
    case "pending":
      return "Pending";
    case "drafted":
      return "Drafted";
    case "released":
      return "Released";
    case "n/a":
      return "N/A";
  }
}
