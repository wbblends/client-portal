import { requireSession } from "@/lib/auth";
import { getQualityTickets, QUALITY_STATUS_META } from "@/lib/data/quality";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Quality — WB Blends" };

export default async function QualityPage() {
  const user = await requireSession();
  const tickets = await getQualityTickets(user.customerId);
  const open = tickets.filter(t => t.status !== "closed").length;
  const closed = tickets.filter(t => t.status === "closed").length;

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground">
          Quality
        </h1>
        <p className="mt-2 text-base text-foreground-soft leading-relaxed max-w-3xl">
          Every quality ticket WB is working through with you — open issues, retains, decisions,
          and credits. 1 in 10 of our team works exclusively in quality.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <li key={t.id} className="px-5 py-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="font-mono text-sm text-muted">{t.ticketNumber}</span>
                        {t.affectedLot && (
                          <span className="text-sm text-muted">· {t.affectedLot}</span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-foreground">{t.name}</h3>
                      <p className="mt-1.5 text-base text-foreground-soft leading-relaxed">
                        {t.description}
                      </p>
                      {t.decision && (
                        <div className="mt-3 rounded-md border-2 border-success/30 bg-success-soft px-4 py-3 text-base text-success">
                          <span className="font-bold">Decision:</span> {t.decision}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted shrink-0 tabular-nums">
                      <div>Opened {t.openedDate}</div>
                      <div className="mt-1">Updated {t.lastUpdated}</div>
                      <div className="mt-2 text-foreground-soft font-semibold">{t.owner}</div>
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
    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-[var(--shadow-card)]">
      <div className="text-base font-semibold text-foreground-soft">{label}</div>
      <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
    </div>
  );
}
