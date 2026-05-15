"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
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
import type {
  AdDailyPoint,
  NetworkMetrics,
  TrafficShareSlice,
} from "@/lib/marketing/hubspot-analytics";
import { formatNumber } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const GOOGLE_COLOR = "var(--color-primary)";
const LINKEDIN_COLOR = "var(--color-border-strong)";

const SHARE_COLORS = [
  "var(--color-primary)",
  "#0a66c2", // LinkedIn blue — used for the paid-social slice so it's recognizable
  "var(--color-foreground-soft)",
  "var(--color-border-strong)",
  "var(--color-muted)",
  "var(--color-accent)",
];

const fmtInt = (v: number) => formatNumber(Math.round(v));
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "var(--shadow-popover)",
};

/**
 * Daily paid-visits trend. Stacked area: Google + LinkedIn so the eye sees
 * both the network split and the overall paid-traffic shape over time.
 */
export function PaidVisitsTrendChart({ points }: { points: AdDailyPoint[] }) {
  const reducedMotion = usePrefersReducedMotion();

  // Long ranges → too many daily ticks to read. Sample tick labels at a
  // reasonable density based on point count.
  const tickInterval = points.length > 90
    ? Math.floor(points.length / 12)
    : points.length > 30
      ? Math.floor(points.length / 10)
      : 0;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="googleFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOOGLE_COLOR} stopOpacity={0.45} />
                <stop offset="100%" stopColor={GOOGLE_COLOR} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="linkedinFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0a66c2" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#0a66c2" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval={tickInterval}
              minTickGap={8}
            />
            <YAxis
              tickFormatter={fmtInt}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
              formatter={(v, name) => [
                fmtInt(Number(v)),
                name === "google" ? "Google Ads" : "LinkedIn Ads",
              ]}
            />
            <Area
              type="monotone"
              dataKey="linkedin"
              stackId="paid"
              stroke="#0a66c2"
              strokeWidth={1.5}
              fill="url(#linkedinFill)"
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="google"
              stackId="paid"
              stroke={GOOGLE_COLOR}
              strokeWidth={1.5}
              fill="url(#googleFill)"
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
              animationBegin={100}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="square"
              formatter={(v) => (v === "google" ? "Google Ads" : "LinkedIn Ads")}
              wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
            />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut of all traffic sources in the range, with paid slices highlighted.
 * Center label shows the total paid share so the eye lands on the headline
 * number before reading the surrounding slices.
 */
export function TrafficShareChart({ slices }: { slices: TrafficShareSlice[] }) {
  const reducedMotion = usePrefersReducedMotion();

  const { total, paidShare } = useMemo(() => {
    const total = slices.reduce((s, x) => s + x.visits, 0);
    const paid = slices.filter(s => s.isPaid).reduce((s, x) => s + x.visits, 0);
    return { total, paidShare: total > 0 ? paid / total : 0 };
  }, [slices]);

  return (
    <div className="relative h-[240px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={slices}
            dataKey="visits"
            nameKey="label"
            innerRadius="62%"
            outerRadius="92%"
            stroke="var(--color-card)"
            strokeWidth={2}
            paddingAngle={1}
            isAnimationActive={!reducedMotion}
            animationDuration={650}
            animationEasing="ease-out"
          >
            {slices.map((slice, idx) => (
              <Cell
                key={slice.key}
                fill={
                  slice.key === "paid-social"
                    ? "#0a66c2"
                    : slice.key === "paid"
                      ? GOOGLE_COLOR
                      : SHARE_COLORS[(idx + 2) % SHARE_COLORS.length]
                }
                opacity={slice.isPaid ? 1 : 0.55}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v, _name, p) => {
              const datum = (p as { payload?: TrafficShareSlice })?.payload;
              return [
                `${fmtInt(Number(v))} visits · ${fmtPct(datum?.share ?? 0)}`,
                datum?.label ?? "",
              ];
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            wrapperStyle={{ fontSize: 11, color: "var(--color-foreground-soft)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
          Paid share
        </div>
        <div className="font-display text-[24px] tabular-nums tracking-tight text-foreground">
          {fmtPct(paidShare)}
        </div>
        <div className="text-[11px] text-muted">{fmtInt(total)} total visits</div>
      </div>
    </div>
  );
}

/**
 * Side-by-side engagement bars per network. Three metric families plotted
 * together so quality differences pop visually instead of being buried in a
 * table. Bounce rate uses 0–1 scale; pages/session and time/session are
 * normalized into a shared 0–100 scale via per-metric max so the bars stay
 * comparable across very different units.
 */
export function EngagementCompareChart({ networks }: { networks: NetworkMetrics[] }) {
  const reducedMotion = usePrefersReducedMotion();

  const data = useMemo(() => {
    return [
      {
        metric: "Bounce rate",
        google: networks.find(n => n.network === "google")?.bounceRate ?? 0,
        linkedin: networks.find(n => n.network === "linkedin")?.bounceRate ?? 0,
        unit: "pct",
      },
      {
        metric: "Pages / session",
        google: networks.find(n => n.network === "google")?.pageviewsPerSession ?? 0,
        linkedin: networks.find(n => n.network === "linkedin")?.pageviewsPerSession ?? 0,
        unit: "num",
      },
      {
        metric: "Avg time (s)",
        google: networks.find(n => n.network === "google")?.timePerSession ?? 0,
        linkedin: networks.find(n => n.network === "linkedin")?.timePerSession ?? 0,
        unit: "sec",
      },
    ];
  }, [networks]);

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="metric"
            tick={{ fill: "var(--color-foreground-soft)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
          />
          <YAxis
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={42}
            tickFormatter={(v) => formatNumber(Number(v), { compact: true })}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
            formatter={(v, name, p) => {
              const unit = (p as { payload?: { unit?: string } })?.payload?.unit;
              const num = Number(v);
              const formatted =
                unit === "pct"
                  ? fmtPct(num)
                  : unit === "sec"
                    ? `${num.toFixed(1)}s`
                    : num.toFixed(2);
              return [formatted, name === "google" ? "Google Ads" : "LinkedIn Ads"];
            }}
          />
          <Bar
            dataKey="google"
            fill={GOOGLE_COLOR}
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
          />
          <Bar
            dataKey="linkedin"
            fill="#0a66c2"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
            animationBegin={100}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="square"
            formatter={(v) => (v === "google" ? "Google Ads" : "LinkedIn Ads")}
            wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { LINKEDIN_COLOR, GOOGLE_COLOR };
