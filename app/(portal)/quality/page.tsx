import { requireSession } from "@/lib/auth";
import {
  getQualityTickets,
  QUALITY_STATUS_META,
  type QualityTicket,
} from "@/lib/data/quality";
import {
  parseSearchParam,
  parseMultiParam,
  matchesAny,
  compareBy,
} from "@/lib/filters";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/ui/filter-bar";

export const metadata = { title: "Quality — WB Blends" };

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Last Updated (newest)" },
  { value: "updated-asc", label: "Last Updated (oldest)" },
  { value: "opened-desc", label: "Opened (newest)" },
  { value: "opened-asc", label: "Opened (oldest)" },
];

const STATUS_OPTIONS = (Object.keys(QUALITY_STATUS_META) as Array<keyof typeof QUALITY_STATUS_META>).map(
  s => ({ value: s, label: QUALITY_STATUS_META[s].label }),
);

/** Tickets store dates as "M/D/YY" strings; lexicographic sort would mis-order
 *  multi-digit days against single-digit ones. Parse to a comparable timestamp. */
function parseShortDate(s: string): number {
  const [m, d, y] = s.split("/").map(n => parseInt(n, 10));
  if (!m || !d || y == null) return 0;
  const yyyy = y < 100 ? 2000 + y : y;
  return new Date(yyyy, m - 1, d).getTime();
}

function resolveTicketField(t: QualityTicket, field: string) {
  switch (field) {
    case "opened":
      return parseShortDate(t.openedDate);
    case "updated":
    default:
      return parseShortDate(t.lastUpdated);
  }
}

export default async function QualityPage(props: PageProps<"/quality">) {
  const user = await requireSession();
  const sp = await props.searchParams;
  const all = await getQualityTickets(user.customerId);

  const q = parseSearchParam(sp.q).toLowerCase();
  const statuses = parseMultiParam(sp.status);
  const sort = parseSearchParam(sp.sort) || "updated-desc";

  let tickets = all;
  if (q) {
    tickets = tickets.filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        (t.affectedLot?.toLowerCase().includes(q) ?? false),
    );
  }
  if (statuses.length) {
    tickets = tickets.filter(t => matchesAny(t.status, statuses));
  }
  tickets = [...tickets].sort(compareBy(sort, resolveTicketField));

  const open = all.filter(t => t.status !== "closed").length;
  const closed = all.filter(t => t.status === "closed").length;

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
        <SummaryTile label="Open Tickets" value={String(open)} />
        <SummaryTile label="Closed Tickets" value={String(closed)} subtitle="Last 12 Months" />
        <SummaryTile label="Quality Contact" value="Marco Liu" subtitle="quality@wbblends.com" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            {tickets.length === all.length
              ? "Most recent first. Closed tickets retain the resolution decision so you have a written record of the call."
              : `Showing ${tickets.length} of ${all.length} tickets.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilterBar
            searchParam="q"
            searchPlaceholder="Search ticket # or text…"
            filterGroups={[
              { param: "status", label: "Status", options: STATUS_OPTIONS },
            ]}
            sort={{ options: SORT_OPTIONS, defaultValue: "updated-desc" }}
          />
        </CardContent>
        <CardContent className="px-0 pt-0">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 text-center border-t border-border">
              <p className="text-sm font-medium text-foreground">No matching tickets</p>
              <p className="mt-1 text-sm text-muted max-w-sm">
                Try clearing a filter or broadening your search to see more results.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {tickets.map(t => {
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
          )}
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
