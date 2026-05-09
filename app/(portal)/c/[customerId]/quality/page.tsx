import { requireCustomerAccess } from "@/lib/auth";
import { getQualityTickets, QUALITY_STATUS_META } from "@/lib/data/quality";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Quality — WB Blends" };

export default async function QualityPage(props: PageProps<"/c/[customerId]/quality">) {
  const { customerId } = await props.params;
  const { customer } = await requireCustomerAccess(customerId);
  const tickets = await getQualityTickets(customer.id);
  const open = tickets.filter(t => t.status !== "closed").length;
  const closed = tickets.filter(t => t.status === "closed").length;

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm text-muted">{customer.name}</p>
        <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
          Quality
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every quality ticket WB is working through with you — open issues, retains, decisions,
          and credits. 1 in 10 of our team works exclusively in quality.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <SummaryTile label="Open Tickets" value={String(open)} />
        <SummaryTile label="Closed Tickets" value={String(closed)} subtitle="Last 12 Months" />
        <SummaryTile label="Quality Contact" value="Marco Liu" subtitle="quality@wbblends.com" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            Most recent first. Closed tickets retain the resolution decision so you have a written
            record of the call.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {tickets.map(t => {
              const meta = QUALITY_STATUS_META[t.status];
              return (
                <li key={t.id} className="px-4 sm:px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-[11px] text-muted">{t.ticketNumber}</span>
                        {t.affectedLot && (
                          <span className="text-[11px] text-muted">· {t.affectedLot}</span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold text-foreground">{t.name}</h3>
                      <p className="mt-1 text-sm text-foreground-soft leading-snug">
                        {t.description}
                      </p>
                      {t.decision && (
                        <div className="mt-2.5 rounded-md border border-success/15 bg-success-soft px-3 py-2 text-[13px] text-success">
                          <span className="font-semibold">Decision:</span> {t.decision}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-row flex-wrap gap-x-4 gap-y-0.5 sm:flex-col sm:text-right text-xs text-muted shrink-0 tabular-nums">
                      <div>Opened {t.openedDate}</div>
                      <div>Updated {t.lastUpdated}</div>
                      <div className="text-foreground-soft sm:mt-1.5">{t.owner}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="mt-1.5 text-[26px] font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
    </div>
  );
}
