import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  Card,
  CardHeader,
  CardTitle,
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
import { MonthlyPosReceivedChart } from "@/components/dashboard/orders-received-chart";
import type { MonthlyPosReceivedPoint } from "@/components/dashboard/orders-received-chart-impl";
import {
  getPipelineKanban,
  summarizeKanban,
  type KanbanData,
} from "@/lib/marketing/hubspot";
import {
  getPipelineHistory,
  type PipelineHistory,
} from "@/lib/marketing/pipeline-history";
import { listOrdersRows, type DbOrdersRow } from "@/lib/orders/store";
import { listTickets, type Ticket } from "@/lib/tickets/store";
import { isLate, isParked } from "@/lib/tickets/status";
import { ACTUALS_2025, MONTHLY_TARGETS, MONTH_SHORT } from "@/lib/data/orders-portal";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { MagicalSearchBar } from "@/components/ai-bot/MagicalSearchBar";

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

const pctOf = (v: number, target: number) =>
  target > 0
    ? `${Math.round((v / target) * 100)}% of ${formatCurrency(target, { compact: true })} target`
    : "no target set";

/**
 * Homepage.
 *
 * The shell (greeting + section scaffolding) paints immediately. Each section
 * awaits its own data inside an independent <Suspense> boundary, so a slow
 * HubSpot round-trip can no longer block the whole page from rendering:
 *
 *  - Orders / forecast + Monthly POs   → local DB (`listOrdersRows`), fast
 *  - Project tickets                   → local DB (`listTickets`), fast
 *  - Open pipeline + Top deals         → HubSpot kanban, can be slow on a cold
 *                                        cache — streamed in independently
 *  - Cumulative open pipeline          → HubSpot history, likewise streamed
 *
 * Each fetch is kicked off (not awaited) before render and the promise is
 * passed down. The HubSpot fetchers are wrapped in `unstable_cache`, so the
 * kanban promise shared between two sections is still a single round-trip.
 */
export default async function HomePage() {
  const user = await requireSession();
  const firstName = user.name.split(" ")[0];
  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName);

  if (!isAdminRole(user.role)) {
    return (
      <div className="page-container page-pad-x page-pad-y space-y-7">
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          {greeting}
        </h1>
        <div className="max-w-3xl">
          <MagicalSearchBar />
        </div>
      </div>
    );
  }

  // Start every fetch now, but don't await — each section resolves its own
  // promise inside a <Suspense> boundary below.
  const range = lastTwelveMonthsRange();
  const kanbanPromise = getPipelineKanban();
  const historyPromise = getPipelineHistory(range);
  const ordersPromise = listOrdersRows();
  const ticketsPromise = listTickets();

  return (
    <div className="page-container page-pad-x page-pad-y space-y-7">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground">
          {greeting}
        </h1>
      </div>

      <div className="max-w-3xl">
        <MagicalSearchBar />
      </div>

      {/* Orders + forecast */}
      <Suspense
        fallback={
          <SectionSkeleton
            title="Orders & forecast"
            href="/dashboards/orders-portal"
            tiles={4}
          />
        }
      >
        <OrdersForecastSection ordersPromise={ordersPromise} />
      </Suspense>

      {/* Pipeline KPI strip */}
      <Suspense
        fallback={
          <SectionSkeleton
            title="Open pipeline"
            href="/dashboards/pipeline-analytics"
            tiles={3}
          />
        }
      >
        <PipelineKpiSection kanbanPromise={kanbanPromise} />
      </Suspense>

      {/* Charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open POs · last 12 weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <BacklogWeeklyChart />
          </CardContent>
        </Card>
        <Suspense
          fallback={<ChartCardSkeleton title="Cumulative open pipeline" height={260} />}
        >
          <CumulativePipelineSection historyPromise={historyPromise} />
        </Suspense>
      </section>

      {/* Monthly POs received */}
      <Suspense
        fallback={<ChartCardSkeleton title="Monthly POs received" height={280} />}
      >
        <MonthlyPosSection ordersPromise={ordersPromise} />
      </Suspense>

      {/* Top deals */}
      <Suspense fallback={<TopDealsSkeleton />}>
        <TopDealsSection kanbanPromise={kanbanPromise} />
      </Suspense>

      {/* Tickets */}
      <Suspense fallback={<TicketsSkeleton />}>
        <TicketsSection ticketsPromise={ticketsPromise} />
      </Suspense>
    </div>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

async function OrdersForecastSection({
  ordersPromise,
}: {
  ordersPromise: Promise<DbOrdersRow[]>;
}) {
  const ordersRows = await ordersPromise;

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const nextMonthIdx = (currentMonthIdx + 1) % 12;
  const monthAfterIdx = (currentMonthIdx + 2) % 12;

  const currentMonthActual = sumMonthly(ordersRows, currentMonthIdx, "months");
  const currentMonthForecast = sumMonthly(ordersRows, currentMonthIdx, "forecasts");
  const nextMonthForecast = sumMonthly(ordersRows, nextMonthIdx, "forecasts");
  const monthAfterForecast = sumMonthly(ordersRows, monthAfterIdx, "forecasts");

  const currentTarget = MONTHLY_TARGETS[currentMonthIdx];
  const nextTarget = MONTHLY_TARGETS[nextMonthIdx];
  const monthAfterTarget = MONTHLY_TARGETS[monthAfterIdx];

  const monthLabel = MONTH_SHORT[currentMonthIdx];
  const nextLabel = MONTH_SHORT[nextMonthIdx];
  const afterLabel = MONTH_SHORT[monthAfterIdx];

  return (
    <section className="space-y-3">
      <SectionHeader title="Orders & forecast" href="/dashboards/orders-portal" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label={`${monthLabel} actuals`}
          value={formatCurrency(currentMonthActual)}
          hint={pctOf(currentMonthActual, currentTarget)}
        />
        <KpiTile
          label={`${monthLabel} forecast`}
          value={formatCurrency(currentMonthForecast)}
          hint={pctOf(currentMonthForecast, currentTarget)}
          tone="warning"
        />
        <KpiTile
          label={`${nextLabel} forecast`}
          value={formatCurrency(nextMonthForecast)}
          hint={pctOf(nextMonthForecast, nextTarget)}
          tone="warning"
        />
        <KpiTile
          label={`${afterLabel} forecast`}
          value={formatCurrency(monthAfterForecast)}
          hint={pctOf(monthAfterForecast, monthAfterTarget)}
          tone="warning"
        />
      </div>
    </section>
  );
}

async function PipelineKpiSection({
  kanbanPromise,
}: {
  kanbanPromise: Promise<KanbanData>;
}) {
  const kanban = await kanbanPromise;
  const pipelines = summarizeKanban(kanban);

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Open pipeline"
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
  );
}

async function CumulativePipelineSection({
  historyPromise,
}: {
  historyPromise: Promise<PipelineHistory>;
}) {
  const history = await historyPromise;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Cumulative open pipeline</CardTitle>
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
  );
}

async function MonthlyPosSection({
  ordersPromise,
}: {
  ordersPromise: Promise<DbOrdersRow[]>;
}) {
  const ordersRows = await ordersPromise;

  // 2025 actuals + 2026 actuals to date, trimmed at the last month with booked
  // revenue so future zero months don't render as empty bars.
  const monthTotals2026 = Array.from({ length: 12 }, (_, i) =>
    sumMonthly(ordersRows, i, "months"),
  );
  let lastWithData = -1;
  for (let i = 11; i >= 0; i--) {
    if (monthTotals2026[i] > 0) {
      lastWithData = i;
      break;
    }
  }
  const actuals2026 = lastWithData === -1 ? [] : monthTotals2026.slice(0, lastWithData + 1);
  const posReceivedPoints: MonthlyPosReceivedPoint[] = [
    ...ACTUALS_2025.map(({ month, value }) => ({
      label: `${month}-25`,
      actual: value,
      target: null,
      isYear2026: false,
    })),
    ...actuals2026.map((value, i) => ({
      label: `${MONTH_SHORT[i]}-26`,
      actual: value,
      target: MONTHLY_TARGETS[i],
      isYear2026: true,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Monthly POs received</CardTitle>
          <Link
            href="/dashboards/orders-portal"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            Open <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <MonthlyPosReceivedChart points={posReceivedPoints} />
      </CardContent>
    </Card>
  );
}

async function TopDealsSection({
  kanbanPromise,
}: {
  kanbanPromise: Promise<KanbanData>;
}) {
  const kanban = await kanbanPromise;
  const salesPipeline = kanban.pipelines.find(p => p.key === "sales");
  const expansionPipeline = kanban.pipelines.find(p => p.key === "expansion");
  const newLogoTop = salesPipeline ? scoreDealsForPipeline(salesPipeline) : [];
  const expansionTop = expansionPipeline ? scoreDealsForPipeline(expansionPipeline) : [];

  return (
    <section className="space-y-3">
      <SectionHeader title="Top deals" source={kanban.source} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopDealsCard title="New Logo Pipeline" deals={newLogoTop} />
        <TopDealsCard title="Wallet Share Pipeline" deals={expansionTop} />
      </div>
    </section>
  );
}

async function TicketsSection({
  ticketsPromise,
}: {
  ticketsPromise: Promise<Ticket[]>;
}) {
  const tickets = await ticketsPromise;
  const openTickets = tickets.filter(t => t.deletedAt === null);
  const ticketsBySection = countBy(openTickets, t => t.tab);
  const healthData = ticketHealth(openTickets);
  const overdueCount = openTickets.filter(t => isLate(t)).length;
  const parkedCount = openTickets.filter(t => isParked(t.status)).length;

  return (
    <section className="space-y-3">
      <SectionHeader title="Project tickets" href="/admin/tickets" />
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
        </CardHeader>
        <CardContent>
          <HomeTicketsDonuts bySection={ticketsBySection} health={healthData} />
        </CardContent>
      </Card>
    </section>
  );
}

// ─── Shared header ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  href,
  source,
}: {
  title: string;
  href?: string;
  source?: "live" | "placeholder";
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[22px] leading-tight tracking-tight text-foreground">
          {title}
        </h2>
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

// ─── Skeleton fallbacks ─────────────────────────────────────────────────────
//
// Each skeleton mirrors the dimensions of the section it stands in for, so
// streamed content swaps in without shifting the layout (CLS).

function KpiTileSkeleton() {
  return <div className="h-[100px] rounded-xl border border-border bg-accent/30" />;
}

function SectionSkeleton({
  title,
  href,
  tiles,
}: {
  title: string;
  href?: string;
  tiles: 3 | 4;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} href={href} />
      <div
        className={cn(
          "grid gap-4",
          tiles === 4
            ? "grid-cols-2 lg:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {Array.from({ length: tiles }).map((_, i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function ChartCardSkeleton({ title, height }: { title: string; height: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="w-full rounded-lg bg-accent/30"
          style={{ height }}
        />
      </CardContent>
    </Card>
  );
}

function TopDealsSkeleton() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Top deals" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[420px] rounded-xl border border-border bg-accent/30" />
        <div className="h-[420px] rounded-xl border border-border bg-accent/30" />
      </div>
    </section>
  );
}

function TicketsSkeleton() {
  return (
    <section className="space-y-3">
      <SectionHeader title="Project tickets" href="/admin/tickets" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiTileSkeleton key={i} />
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tickets by section & health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-[220px] w-full rounded-lg bg-accent/30" />
            <div className="h-[220px] w-full rounded-lg bg-accent/30" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
