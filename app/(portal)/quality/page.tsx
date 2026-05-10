import { requireSession } from "@/lib/auth";
import { getQualityTickets, getQualitySummary, QUALITY_STATUS_META } from "@/lib/data/quality";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { parsePagination, toPageOpts } from "@/lib/pagination";
import { getPersistedPageSize } from "@/lib/pagination-server";

export const metadata = { title: "Quality — WB Blends" };

export default async function QualityPage(props: PageProps<"/quality">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const defaultPageSize = await getPersistedPageSize();
  const state = parsePagination(sp, { defaultPageSize });

  const [{ items, total }, summary] = await Promise.all([
    getQualityTickets(user.customerId, toPageOpts(state)),
    getQualitySummary(user.customerId),
  ]);

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
          Quality
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every quality ticket WB is working through with you — open issues, retains, decisions,
          and credits. 1 in 10 of our team works exclusively in quality.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryTile label="Open Tickets" value={String(summary.open)} />
        <SummaryTile label="Closed Tickets" value={String(summary.closed)} subtitle="Last 12 Months" />
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
            {items.map(t => {
              const meta = QUALITY_STATUS_META[t.status];
              return (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
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
                    <div className="text-right text-xs text-muted shrink-0 tabular-nums">
                      <div>Opened {t.openedDate}</div>
                      <div className="mt-0.5">Updated {t.lastUpdated}</div>
                      <div className="mt-1.5 text-foreground-soft">{t.owner}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            total={total}
            page={state.page}
            pageSize={state.pageSize}
            itemLabel="tickets"
          />
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
