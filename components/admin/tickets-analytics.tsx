"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isLate, isParked, daysOpen } from "@/lib/tickets/status";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { formatNumber } from "@/lib/utils";

type TicketColor = "red" | "white" | "gray" | null;

type Ticket = {
  id: string;
  tab: string;
  version: string;
  name: string;
  productType: string;
  customer: string;
  salesperson: string;
  status: string;
  openDate: string | null;
  dueDate: string | null;
  color: TicketColor;
  rank: number | null;
  lastSyncedAt: string;
  deletedAt: string | null;
};

type Datum = { name: string; value: number };

// Slice/bar palette for the multi-category charts — drawn from the brand
// tokens so the charts theme with the app (and re-theme on dark-mode toggle).
const PALETTE = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "#0a66c2",
  "var(--color-muted)",
  "var(--color-border-strong)",
];

// Ticket-health slice colors — mirror the board's row colors: red = overdue,
// gray = parked, green = on track.
const HEALTH_COLORS: Record<string, string> = {
  Overdue: "var(--color-danger)",
  Parked: "var(--color-muted)",
  "On track": "var(--color-success)",
};

// Aging buckets, freshest → stalest, on a green→red ramp.
const AGING_BUCKETS: { name: string; min: number; max: number; color: string }[] = [
  { name: "0–7 days", min: 0, max: 7, color: "var(--color-success)" },
  { name: "8–14 days", min: 8, max: 14, color: "var(--color-primary)" },
  { name: "15–30 days", min: 15, max: 30, color: "var(--color-warning)" },
  { name: "31+ days", min: 31, max: Infinity, color: "var(--color-danger)" },
];

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "var(--shadow-popover)",
} as const;

// ── Aggregation ──

/** Count tickets grouped by a string key; blank keys fold to "—". Sorted by
 *  count descending so the biggest categories lead. */
function countBy(tickets: Ticket[], pick: (t: Ticket) => string): Datum[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const key = pick(t).trim() || "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Average of a per-ticket metric, grouped by key. Tickets whose metric is
 *  null (e.g. no open date) are left out of that group's average rather than
 *  dragging it toward zero. */
function averageBy(
  tickets: Ticket[],
  pick: (t: Ticket) => string,
  metric: (t: Ticket) => number | null,
): Datum[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const t of tickets) {
    const m = metric(t);
    if (m == null) continue;
    const key = pick(t).trim() || "—";
    const cur = acc.get(key) ?? { sum: 0, n: 0 };
    cur.sum += m;
    cur.n += 1;
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([name, { sum, n }]) => ({ name, value: Math.round(sum / n) }))
    .sort((a, b) => b.value - a.value);
}

/** Collapse everything past the top `n` into a single "Other" slice so a
 *  free-text dimension (product type) doesn't explode the donut legend. */
function topNWithOther(data: Datum[], n: number): Datum[] {
  if (data.length <= n) return data;
  const rest = data.slice(n).reduce((s, d) => s + d.value, 0);
  const top = data.slice(0, n);
  return rest > 0 ? [...top, { name: "Other", value: rest }] : top;
}

/** Distribution across mutually exclusive health states. Overdue takes
 *  precedence over parked here (a past-due ticket needs eyes regardless of
 *  who it's waiting on), so the slices sum to the open-ticket total. The
 *  exception is the few `LATE_EXEMPT_STATUSES` (customer / customer
 *  signature / r&d final check) where the ball is in someone else's court
 *  for the rest of the workflow — those fall through to "Parked". */
function healthBreakdown(tickets: Ticket[]): Datum[] {
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

/** Bucket open tickets by how long they've been open. */
function agingBuckets(tickets: Ticket[]): Datum[] {
  const counts = AGING_BUCKETS.map(b => ({ name: b.name, value: 0 }));
  let noDate = 0;
  for (const t of tickets) {
    const d = daysOpen(t.openDate);
    if (d == null) {
      noDate += 1;
      continue;
    }
    const idx = AGING_BUCKETS.findIndex(b => d >= b.min && d <= b.max);
    if (idx >= 0) counts[idx].value += 1;
  }
  if (noDate > 0) counts.push({ name: "No open date", value: noDate });
  return counts;
}

function formatLastSynced(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `today ${time}` : `${d.toLocaleDateString()} ${time}`;
}

// ── Presentational pieces ──

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl tabular-nums tracking-tight text-foreground">
        {formatNumber(value)}
      </p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted">
      No data to chart yet.
    </div>
  );
}

/** Donut with the running total stacked in the middle. */
function DonutChart({
  data,
  colors,
  centerLabel,
  reducedMotion,
}: {
  data: Datum[];
  colors: string[];
  centerLabel: string;
  reducedMotion: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart />;

  return (
    <div className="relative h-[260px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            stroke="var(--color-card)"
            strokeWidth={2}
            paddingAngle={1}
            isAnimationActive={!reducedMotion}
            animationDuration={650}
            animationEasing="ease-out"
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => {
              const v = Number(value);
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return [`${formatNumber(v)} · ${pct}%`, String(name)];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 11, color: "var(--color-foreground-soft)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <div className="font-display text-[26px] tabular-nums tracking-tight text-foreground">
          {formatNumber(total)}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

/** Count/average bars. `horizontal` lays categories down the Y axis — better
 *  for long, free-text labels (product types, customers, salespeople). */
function BarsChart({
  data,
  color,
  cellColors,
  horizontal = false,
  valueLabel,
  valueSuffix = "",
  reducedMotion,
}: {
  data: Datum[];
  color: string;
  cellColors?: string[];
  horizontal?: boolean;
  valueLabel: string;
  valueSuffix?: string;
  reducedMotion: boolean;
}) {
  if (data.length === 0 || data.every(d => d.value === 0)) {
    return <EmptyChart />;
  }

  const fmt = (v: number) => `${formatNumber(v)}${valueSuffix}`;
  const numTick = { fill: "var(--color-muted)", fontSize: 11 };
  const catTick = { fill: "var(--color-foreground-soft)", fontSize: 12 };

  // Horizontal bars get a height proportional to the row count so dense
  // category lists stay legible; clamped so the card doesn't get silly tall.
  const height = horizontal
    ? Math.min(Math.max(data.length * 36, 200), 460)
    : 260;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            horizontal={!horizontal}
            vertical={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={numTick}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={catTick}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                width={140}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="name"
                tick={catTick}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                interval={0}
              />
              <YAxis
                type="number"
                tick={numTick}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--color-accent)" }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
            formatter={(value) => [fmt(Number(value)), valueLabel]}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={horizontal ? 26 : 56}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
          >
            {cellColors
              ? data.map((d, i) => (
                  <Cell key={d.name} fill={cellColors[i % cellColors.length]} />
                ))
              : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Board ──

/**
 * Analytics view for the PM tickets. Aggregates every in-flight ticket (the
 * synced spreadsheet IS the open-ticket list — finished tickets drop out of
 * the sync) into section / product / workload / aging charts. Read-only:
 * polls the same `/api/tickets` endpoint the boards use so a tab left open
 * picks up the daily 7 AM sync.
 */
export function TicketsAnalytics({
  initialTickets,
  initialLastSyncedAt,
}: {
  initialTickets: Ticket[];
  initialLastSyncedAt: string | null;
}) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialLastSyncedAt,
  );
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch("/api/tickets", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          tickets: Ticket[];
          lastSyncedAt: string | null;
        };
        if (!cancelled && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
          setLastSyncedAt(data.lastSyncedAt);
        }
      } catch {
        /* ignore — retry next tick */
      }
    };
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stats = useMemo(() => {
    const total = tickets.length;
    const overdue = tickets.filter(t => isLate(t)).length;
    const parked = tickets.filter(t => isParked(t.status)).length;
    const ages = tickets
      .map(t => daysOpen(t.openDate))
      .filter((d): d is number => d != null);
    const avgAge = ages.length
      ? Math.round(ages.reduce((s, d) => s + d, 0) / ages.length)
      : 0;
    return { total, overdue, parked, avgAge, agedCount: ages.length };
  }, [tickets]);

  const charts = useMemo(
    () => ({
      openBySection: countBy(tickets, t => t.tab),
      health: healthBreakdown(tickets),
      overdueBySection: countBy(
        tickets.filter(t => isLate(t)),
        t => t.tab,
      ),
      ageBySection: averageBy(tickets, t => t.tab, t => daysOpen(t.openDate)),
      openByProduct: topNWithOther(countBy(tickets, t => t.productType), 8),
      overdueByProduct: countBy(
        tickets.filter(t => isLate(t)),
        t => t.productType,
      ),
      ageByProduct: averageBy(
        tickets,
        t => t.productType,
        t => daysOpen(t.openDate),
      ),
      bySalesperson: countBy(tickets, t => t.salesperson),
      topCustomers: countBy(tickets, t => t.customer).slice(0, 10),
      aging: agingBuckets(tickets),
    }),
    [tickets],
  );

  const syncedLine = (
    <div className="flex justify-end">
      <p className="text-xs text-muted">
        {lastSyncedAt
          ? `Last synced ${formatLastSynced(lastSyncedAt)}`
          : "No coworker sync yet"}
      </p>
    </div>
  );

  if (tickets.length === 0) {
    return (
      <div className="space-y-4">
        {syncedLine}
        <Card className="px-6 py-16 text-center text-sm text-muted">
          No tickets yet. The 7&nbsp;AM coworker job will POST rows to{" "}
          <code className="font-mono">/api/tickets/sync</code> and the
          analytics will populate here.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {syncedLine}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open tickets"
          value={stats.total}
          hint="across all sections"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          hint={
            stats.total > 0
              ? `${Math.round((stats.overdue / stats.total) * 100)}% of open tickets`
              : "past due date"
          }
        />
        <StatCard
          label="Avg days open"
          value={stats.avgAge}
          hint={`across ${formatNumber(stats.agedCount)} dated tickets`}
        />
        <StatCard
          label="Parked"
          value={stats.parked}
          hint="waiting on someone else"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          By section
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Open tickets by section"
            description="Every in-flight ticket, grouped by PM workflow."
          >
            <DonutChart
              data={charts.openBySection}
              colors={PALETTE}
              centerLabel="open"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Ticket health"
            description="Overdue takes precedence over parked, so slices sum to the open total."
          >
            <DonutChart
              data={charts.health}
              colors={charts.health.map(
                d => HEALTH_COLORS[d.name] ?? "var(--color-muted)",
              )}
              centerLabel="open"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Overdue tickets by section"
            description="Tickets past their due date."
          >
            <BarsChart
              data={charts.overdueBySection}
              color="var(--color-danger)"
              horizontal
              valueLabel="Overdue"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Average days open by section"
            description="Mean age of open tickets, from open date to today."
          >
            <BarsChart
              data={charts.ageBySection}
              color="var(--color-primary)"
              horizontal
              valueLabel="Avg age"
              valueSuffix=" days"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          By product type
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Open tickets by product type"
            description="Top 8 product types; the rest grouped as Other."
          >
            <DonutChart
              data={charts.openByProduct}
              colors={PALETTE}
              centerLabel="open"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Overdue tickets by product type"
            description="Tickets past their due date."
          >
            <BarsChart
              data={charts.overdueByProduct}
              color="var(--color-danger)"
              horizontal
              valueLabel="Overdue"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
        </div>
        <ChartCard
          title="Average days open by product type"
          description="Mean age of open tickets in each product category."
        >
          <BarsChart
            data={charts.ageByProduct}
            color="var(--color-primary)"
            horizontal
            valueLabel="Avg age"
            valueSuffix=" days"
            reducedMotion={reducedMotion}
          />
        </ChartCard>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Workload &amp; aging
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Open tickets by salesperson"
            description="Current workload across all sections."
          >
            <BarsChart
              data={charts.bySalesperson}
              color="var(--color-info)"
              horizontal
              valueLabel="Open tickets"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
          <ChartCard
            title="Top 10 customers by open tickets"
            description="Customers with the most tickets in flight."
          >
            <BarsChart
              data={charts.topCustomers}
              color="var(--color-primary)"
              horizontal
              valueLabel="Open tickets"
              reducedMotion={reducedMotion}
            />
          </ChartCard>
        </div>
        <ChartCard
          title="Ticket aging"
          description="How long open tickets have been in flight."
        >
          <BarsChart
            data={charts.aging}
            color="var(--color-primary)"
            cellColors={[
              ...AGING_BUCKETS.map(b => b.color),
              "var(--color-muted)",
            ]}
            valueLabel="Tickets"
            reducedMotion={reducedMotion}
          />
        </ChartCard>
      </section>
    </div>
  );
}
