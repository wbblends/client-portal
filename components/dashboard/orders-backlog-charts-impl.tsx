"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const fmt = (v: number) => formatCurrency(v, { compact: true });

const BACKLOG_SNAPSHOTS: Array<{ label: string; value: number | null }> = [
  { label: "Q1-24", value: 7_600_000 },
  { label: "Q2-24", value: 10_300_000 },
  { label: "Q3-24", value: 13_200_000 },
  { label: "Q4-24", value: 16_900_000 },
  { label: "Q1-25", value: 19_700_000 },
  { label: "Q2-25", value: 27_600_000 },
  { label: "Q3-25", value: 25_700_000 },
  { label: "Q4-25", value: 27_100_000 },
  { label: "Feb-26", value: 28_800_000 },
  { label: "Mar-26", value: 30_300_000 },
  { label: "Apr-26", value: 27_286_570 },
  { label: "May-26", value: 27_705_627 },
  { label: "Jun-26", value: 35_200_000 },
];

/**
 * Historical weekly snapshots — the fixed baseline of the 12-week trend.
 * `date` is the ISO snapshot date; the operator's manually-entered daily
 * figures from the open-PO store are merged on top of this by date so the
 * line reflects the latest hand-entered totals (see buildSeries).
 */
const WEEKLY_BACKLOG: Array<{ date: string; value: number }> = [
  { date: "2026-02-23", value: 29_170_124 },
  { date: "2026-03-02", value: 26_423_867 },
  { date: "2026-03-09", value: 27_271_565 },
  { date: "2026-03-16", value: 29_306_520 },
  { date: "2026-03-23", value: 30_435_495 },
  { date: "2026-04-03", value: 27_286_570 },
  { date: "2026-04-09", value: 27_489_483 },
  { date: "2026-04-16", value: 28_796_650 },
  { date: "2026-04-24", value: 30_376_233 },
  { date: "2026-05-01", value: 27_705_627 },
  { date: "2026-05-08", value: 33_925_675 },
  { date: "2026-05-15", value: 33_900_000 },
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-05-21" → "May 21" (parsed without Date to avoid timezone drift). */
function labelForDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${MONTH_ABBR[m - 1]} ${d}`;
}

type WeeklyPoint = { date: string; label: string; value: number };

/**
 * Merge the static weekly baseline with the operator's manually-entered
 * daily figures. An entry overrides the baseline on a same-date match and
 * extends the line forward for any newer date.
 */
function buildSeries(
  entries: Array<{ date: string; amount: number }>,
): WeeklyPoint[] {
  const byDate = new Map<string, number>();
  for (const p of WEEKLY_BACKLOG) byDate.set(p.date, p.value);
  for (const e of entries) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(e.amount)) {
      byDate.set(e.date, e.amount);
    }
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, label: labelForDate(date), value }));
}

const Y_STEP = 4_000_000;

/**
 * Pick a clean y-axis band hugging the data — zoomed in (never from $0) so
 * week-to-week movement is visible, and wide enough to never clip a value.
 */
function yAxisFor(points: WeeklyPoint[]): {
  domain: [number, number];
  ticks: number[];
} {
  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let lo = Math.floor(min / Y_STEP) * Y_STEP;
  let hi = Math.ceil(max / Y_STEP) * Y_STEP;
  if (min - lo < Y_STEP / 2) lo -= Y_STEP;
  if (hi - max < Y_STEP / 2) hi += Y_STEP;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += Y_STEP) ticks.push(t);
  return { domain: [lo, hi], ticks };
}

type TooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
};

function BacklogTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  if (raw === null || raw === undefined) return null;
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        fontSize: 12,
        boxShadow: "var(--shadow-popover)",
        padding: "8px 10px",
        minWidth: 150,
      }}
    >
      <div style={{ color: "var(--color-foreground)", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          color: "var(--color-foreground-soft)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "var(--color-primary)",
              display: "inline-block",
            }}
          />
          Open POs
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-foreground)" }}>
          {fmt(Number(raw))}
        </span>
      </div>
    </div>
  );
}

export function BacklogSnapshotsChart() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <BarChart data={BACKLOG_SNAPSHOTS} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fill: "var(--color-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<BacklogTooltip />} cursor={{ fill: "var(--color-border)", opacity: 0.25 }} />
          <Bar
            dataKey="value"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={42}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: unknown) =>
                v === null || v === undefined ? "" : fmt(Number(v))
              }
              fontSize={11}
              fill="var(--color-foreground)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Marks only the most recent point with an emphasised dot; all earlier
 * points stay dot-free so the line reads cleanly.
 */
function LatestPointDot(props: {
  cx?: number;
  cy?: number;
  index?: number;
  lastIndex?: number;
}) {
  const { cx, cy, index, lastIndex } = props;
  if (index !== lastIndex || cx == null || cy == null) {
    return <g />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="var(--color-primary)" fillOpacity={0.16} />
      <circle
        cx={cx}
        cy={cy}
        r={4.5}
        fill="var(--color-primary)"
        stroke="var(--color-card)"
        strokeWidth={2}
      />
    </g>
  );
}

export function BacklogWeeklyChart() {
  const reducedMotion = usePrefersReducedMotion();
  const [data, setData] = useState<WeeklyPoint[]>(() => buildSeries([]));

  // Pull the operator's manually-entered daily figures and merge them into
  // the line so newly-recorded dates (May 21, 22, …) show up live.
  const refresh = useCallback(() => {
    fetch("/api/orders-backlog/open-po")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && Array.isArray(d.entries)) setData(buildSeries(d.entries));
      })
      .catch(() => {
        /* keep the baseline series on a failed fetch */
      });
  }, []);

  useEffect(() => {
    refresh();
    // Re-fetch the instant a new figure is saved on the Orders Backlog page.
    const onUpdate = () => refresh();
    window.addEventListener("open-po:updated", onUpdate);
    return () => window.removeEventListener("open-po:updated", onUpdate);
  }, [refresh]);

  const lastIndex = data.length - 1;
  const { domain, ticks } = yAxisFor(data);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="openPosArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.6} vertical={false} />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
          />
          <YAxis
            // Zoom to the data band instead of starting at $0, so week-to-week
            // movement is actually visible.
            domain={domain}
            ticks={ticks}
            tickFormatter={fmt}
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            content={<BacklogTooltip />}
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            fill="url(#openPosArea)"
            dot={<LatestPointDot lastIndex={lastIndex} />}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-card)" }}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
