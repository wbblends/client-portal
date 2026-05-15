import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { BacklogWeeklyChart } from "@/components/dashboard/orders-backlog-charts";
import { CumulativePipelineChart } from "@/components/dashboard/marketing-pipeline-chart";
import { HomeTicketsDonuts } from "@/components/dashboard/home-tickets-donuts";
import {
  TopDealsCard,
  scoreDealsForPipeline,
} from "@/components/dashboard/home-top-deals";
import {
  getPipelineSummary,
  getPipelineKanban,
} from "@/lib/marketing/hubspot";
import { getPipelineHistory } from "@/lib/marketing/pipeline-history";
import { listOrdersRows, type DbOrdersRow } from "@/lib/orders/store";
import { listTickets, type Ticket } from "@/lib/tickets/store";
import { isLate, isParked } from "@/lib/tickets/status";
import { MONTHLY_TARGETS, MONTH_SHORT } from "@/lib/data/orders-portal";
import { formatCurrency, formatNumber } from "@/lib/utils";

// Greeting templates rotate on every refresh. The page is already dynamic
// (requireSession reads cookies), so Math.random() runs per request.
const GREETINGS: ((n: string) => string)[] = [
  (n) => `Welcome back to the synergy zone, ${n}...`,
  (n) => `${n}, ready to move the needle today...`,
  (n) => `Greetings, ${n} — let's circle back to greatness...`,
  (n) => `${n}, time to leverage some core competencies...`,
  (n) => `Look who's pivoting into the office — hey, ${n}...`,
  (n) => `${n}, your bandwidth is looking impeccable today...`,
  (n) => `Welcome, ${n} — let's unpack today's deliverables...`,
  (n) => `${n}, the KPIs missed you...`,
  (n) => `Reporting for synergy, ${n}...`,
  (n) => `${n}, ready to disrupt some paradigms...`,
  (n) => `Welcome aboard, ${n} — the deck has been pre-aligned...`,
  (n) => `${n}, let's take this one offline... but in here...`,
  (n) => `Hot off the standup, ${n} — what's our north star today...`,
  (n) => `${n}, you're absolutely crushing the optics...`,
  (n) => `Greetings, ${n} — synergies are tracking ahead of plan...`,
  (n) => `${n}, the action items have been waiting...`,
  (n) => `Welcome, ${n} — let's blue-sky this one...`,
  (n) => `${n}, ready to right-size some workflows...`,
  (n) => `Look alive, ${n} — the runway is wide open...`,
  (n) => `${n}, your stakeholder energy is unmatched today...`,
  (n) => `Welcome, ${n} — we've got the green light on all fronts...`,
  (n) => `${n}, let's drill down and double-click on today...`,
  (n) => `Top of the funnel to you, ${n}...`,
  (n) => `${n}, the low-hanging fruit awaits...`,
  (n) => `Welcome, ${n} — let's table-stakes this morning...`,
  (n) => `${n}, your value-add is showing...`,
  (n) => `Greetings, ${n} — let's get our ducks in a row...`,
  (n) => `${n}, time to operationalize the vision...`,
  (n) => `Welcome, ${n} — consider the loop officially closed...`,
  (n) => `${n}, you're moving needles I didn't even know existed...`,
  (n) => `Glad you could join the standup, ${n}...`,
  (n) => `${n}, let's punch above our weight class today...`,
  (n) => `Welcome, ${n} — the deliverables are crisp...`,
  (n) => `${n}, bandwidth permitting, today looks promising...`,
  (n) => `Hey ${n} — quick gut-check: ready to win the day...`,
];

function sumMonthly(
  rows: DbOrdersRow[],
  monthIdx: number,
  field: "months" | "forecasts",
): number {
  let total = 0;
  for (const r of rows) {
    const v = r[field][monthIdx];
    if (typeof v === "number" && Number.isFinite(v)) total += v;
  }
  return total;
}

function countBy<T>(items: T[], pick: (t: T) => string): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = pick(item).trim() || "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function ticketHealth(tickets: Ticket[]) {
  let overdue = 0;
  let parked = 0;
  let onTrack = 0;
  for (const t of tickets) {
    if (isLate(t)) overdue += 1;
    else if (isParked(t.status)) parked += 1;
    else onTrack += 1;
  }
  return [
    { name: "Overdue", value: overdue },
    { name: "Parked", value: parked },
    { name: "On track", value: onTrack },
  ].filter(d => d.value > 0);
}

// 12-month window ending today, anchored to month boundaries. Drives the
// cumulative-pipeline chart's bucketing (one bar per month).
function lastTwelveMonthsRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export default async function HomePage() {
  const user = await requireSession();
  const firstName = user.name.split(" ")[0];
  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName);

  if (!isAdminRole(user.role)) {
    return (
      <div className="page-container page-pad-x page-pad-y">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          {greeting}
        </h1>
      </div>
    );
  }

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const nextMonthIdx = (currentMonthIdx + 1) % 12;
  const monthAfterIdx = (currentMonthIdx + 2) % 12;

  // Each fetcher has its own fallback so a single upstream failure doesn't
  // take down the whole homepage.
  const range = lastTwelveMonthsRange();
  const [pipelines, kanban, history, ordersRows, tickets] = await Promise.all([
    getPipelineSummary(),
    getPipelineKanban(),
    getPipelineHistory(range),
    listOrdersRows(),
    listTickets(),
  ]);

  const currentMonthActual = sumMonthly(ordersRows, currentMonthIdx, "months");
  const currentMonthForecast = sumMonthly(ordersRows, currentMonthIdx, "forecasts");
  const nextMonthForecast = sumMonthly(ordersRows, nextMonthIdx, "forecasts");
  const monthAfterForecast = sumMonthly(ordersRows, monthAfterIdx, "forecasts");

  const currentTarget = MONTHLY_TARGETS[currentMonthIdx];
  const nextTarget = MONTHLY_TARGETS[nextMonthIdx];
  const monthAfterTarget = MONTHLY_TARGETS[monthAfterIdx];

  const pctOf = (v: number, target: number) =>
    target > 0
      ? `${Math.round((v / target) * 100)}% of ${formatCurrency(target, { compact: true })} target`
      : "no target set";

  const salesPipeline = kanban.pipelines.find(p => p.key === "sales");
  const expansionPipeline = kanban.pipelines.find(p => p.key === "expansion");
  const newLogoTop = salesPipeline ? scoreDealsForPipeline(salesPipeline) : [];
  const expansionTop = expansionPipeline ? scoreDealsForPipeline(expansionPipeline) : [];

  const openTickets = tickets.filter(t => t.deletedAt === null);
  const ticketsBySection = countBy(openTickets, t => t.tab);
  const healthData = ticketHealth(openTickets);
  const overdueCount = openTickets.filter(t => isLate(t)).length;
  const parkedCount = openTickets.filter(t => isParked(t.status)).length;

  const monthLabel = MONTH_SHORT[currentMonthIdx];
  const nextLabel = MONTH_SHORT[nextMonthIdx];
  const afterLabel = MONTH_SHORT[monthAfterIdx];

  return (
    <div className="page-container page-pad-x page-pad-y space-y-7">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-muted">
          At-a-glance snapshot across orders, pipeline, and project tickets.
        </p>
      </div>

      {/* Orders + forecast */}
      <section className="space-y-3">
        <SectionHeader
          title="Orders & forecast"
          description={`${monthLabel} actuals plus rolling forecasts for the next two months. Targets sourced from the 2026 Sales Metrics workbook.`}
          href="/dashboards/orders-portal"
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            label={`${monthLabel} actuals`}
            value={formatCurrency(currentMonthActual, { compact: true })}
            hint={pctOf(currentMonthActual, currentTarget)}
          />
          <KpiTile
            label={`${monthLabel} forecast`}
            value={formatCurrency(currentMonthForecast, { compact: true })}
            hint={pctOf(currentMonthForecast, currentTarget)}
          />
          <KpiTile
            label={`${nextLabel} forecast`}
            value={formatCurrency(nextMonthForecast, { compact: true })}
            hint={pctOf(nextMonthForecast, nextTarget)}
          />
          <KpiTile
            label={`${afterLabel} forecast`}
            value={formatCurrency(monthAfterForecast, { compact: true })}
            hint={pctOf(monthAfterForecast, monthAfterTarget)}
          />
        </div>
      </section>

      {/* Pipeline KPI strip */}
      <section className="space-y-3">
        <SectionHeader
          title="Open pipeline"
          description="Live snapshot across both HubSpot pipelines. Weighted = amount × stage probability."
          href="/dashboards/pipeline-analytics"
          source={pipelines.source}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile
            label="Open deals"
            value={formatNumber(pipelines.combined.dealCount)}
            hint={`${formatNumber(pipelines.perPipeline.sales.dealCount)} new logo · ${formatNumber(pipelines.perPipeline.expansion.dealCount)} wallet share`}
          />
          <KpiTile
            label="Unweighted pipeline"
            value={formatCurrency(pipelines.combined.unweighted, { compact: true })}
            hint="Sum of open deal amounts"
          />
          <KpiTile
            label="Weighted pipeline"
            value={formatCurrency(pipelines.combined.weighted, { compact: true })}
            hint="Amount × stage probability"
          />
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open POs · last 12 weeks</CardTitle>
            <CardDescription>
              Weekly backlog snapshots from the cash-flow report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BacklogWeeklyChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Cumulative open pipeline</CardTitle>
                <CardDescription>
                  Open unweighted value at each month end, split by pipeline.
                </CardDescription>
              </div>
              {history.source === "placeholder" && (
                <Badge tone="warning" className="shrink-0">Demo data</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CumulativePipelineChart buckets={history.buckets} />
          </CardContent>
        </Card>
      </section>

      {/* Top deals */}
      <section className="space-y-3">
        <SectionHeader
          title="Top deals"
          description="Composite ranking blending recent comments, weighted value, stage progress, and progress per day open."
          source={kanban.source}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopDealsCard
            title="New Logo Pipeline"
            description={`Top ${Math.min(5, newLogoTop.length)} open deals by composite score.`}
            deals={newLogoTop}
          />
          <TopDealsCard
            title="Wallet Share Pipeline"
            description={`Top ${Math.min(5, expansionTop.length)} open deals by composite score.`}
            deals={expansionTop}
          />
        </div>
      </section>

      {/* Tickets */}
      <section className="space-y-3">
        <SectionHeader
          title="Project tickets"
          description="In-flight PM tickets from the 7 AM coworker sync."
          href="/admin/tickets"
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile
            label="Open tickets"
            value={formatNumber(openTickets.length)}
            hint="across all sections"
          />
          <KpiTile
            label="Overdue"
            value={formatNumber(overdueCount)}
            hint={
              openTickets.length > 0
                ? `${Math.round((overdueCount / openTickets.length) * 100)}% of open`
                : "past due date"
            }
            preferDirection="down"
          />
          <KpiTile
            label="Parked"
            value={formatNumber(parkedCount)}
            hint="waiting on someone else"
            preferDirection="down"
          />
          <KpiTile
            label="Sections in flight"
            value={formatNumber(ticketsBySection.length)}
            hint="distinct workflows"
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Tickets by section & health</CardTitle>
            <CardDescription>
              Left: open tickets grouped by PM workflow. Right: overdue / parked / on-track split.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HomeTicketsDonuts bySection={ticketsBySection} health={healthData} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  href,
  source,
}: {
  title: string;
  description: string;
  href?: string;
  source?: "live" | "placeholder";
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[22px] leading-tight tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-1 max-w-[760px] text-sm text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {source === "placeholder" && (
          <Badge tone="warning" className="mt-1">Demo data</Badge>
        )}
        {href && (
          <Link
            href={href}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            Open <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
