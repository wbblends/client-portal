"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PipelineHistoryBucket } from "@/lib/marketing/pipeline-history";
import { formatCurrency } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const fmt = (v: number) => formatCurrency(v, { compact: true });

// The two HubSpot pipelines, in stacking order (bottom → top). Labels are the
// internal names Devin uses; kept in sync with lib/marketing/hubspot.ts.
// Both series live on the brand purple ramp — the deeper shade anchors the
// stack and the lighter mid-lavender sits above it. Two purples instead of
// purple-vs-green so the chart reads as one brand family rather than a
// semantic split.
const PIPELINE_SERIES = [
  { key: "sales", label: "New Logo Pipeline", color: "var(--chart-purple-1)" },
  { key: "expansion", label: "Wallet Share Pipeline", color: "var(--chart-purple-2)" },
] as const;

type TooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
};

/** Custom stacked-bar tooltip — lists each pipeline plus the collective
 *  open-pipeline total for that bucket. */
function CumulativeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  // Exclude the trendline from the stacked-pipeline total — it's a derived
  // line, not an actual pipeline bucket.
  const bars = payload.filter(p => p.dataKey !== "trend");
  const trend = payload.find(p => p.dataKey === "trend");
  const total = bars.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        fontSize: 12,
        boxShadow: "var(--shadow-popover)",
        padding: "8px 10px",
        minWidth: 190,
      }}
    >
      <div style={{ color: "var(--color-foreground)", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {bars.map(p => (
        <div
          key={String(p.dataKey)}
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
                background: p.color,
                display: "inline-block",
              }}
            />
            {p.name}
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-foreground)" }}>
            {fmt(Number(p.value))}
          </span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          marginTop: 6,
          paddingTop: 6,
          borderTop: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
          fontWeight: 600,
        }}
      >
        <span>Total open</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
      </div>
      {trend ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 4,
            color: "var(--color-foreground-soft)",
            fontSize: 11,
          }}
        >
          <span>Trend</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(Number(trend.value))}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cumulative open pipeline value at each bucket end — a stacked bar chart
 * split by pipeline. Each bar's height is the collective open-pipeline value
 * at that point in time; the two stacked segments are the New Logo and Wallet
 * Share pipelines.
 */
export function CumulativePipelineChart({ buckets }: { buckets: PipelineHistoryBucket[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reducedMotion = usePrefersReducedMotion();

  const base = buckets.map(b => ({
    label: b.label,
    sales: b.openUnweightedByPipeline.sales,
    expansion: b.openUnweightedByPipeline.expansion,
    total: b.openUnweightedByPipeline.sales + b.openUnweightedByPipeline.expansion,
  }));

  // Linear-regression best-fit line over the bucket totals — shows whether
  // collective open pipeline is trending up or down across the window.
  const n = base.length;
  let slope = 0;
  let intercept = 0;
  if (n > 1) {
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += base[i].total;
      sumXY += i * base[i].total;
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    intercept = (sumY - slope * sumX) / n;
  } else if (n === 1) {
    intercept = base[0].total;
  }
  const data = base.map((d, i) => ({ ...d, trend: Math.max(0, intercept + slope * i) }));

  return (
    <div className="h-[260px] w-full">
      {mounted ? (
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
            <Tooltip content={<CumulativeTooltip />} />
            {PIPELINE_SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                stackId="open"
                radius={i === PIPELINE_SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={42}
                isAnimationActive={!reducedMotion}
                animationDuration={550}
                animationEasing="ease-out"
                animationBegin={i * 80}
              />
            ))}
            <Line
              type="linear"
              dataKey="trend"
              name="Trend"
              stroke="var(--color-foreground)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
              animationBegin={PIPELINE_SERIES.length * 80}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="square"
              wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full rounded-lg bg-accent/30" />
      )}
    </div>
  );
}

/**
 * Pipeline flow per bucket — added (positive) vs closed-won + closed-lost
 * (negative). Stacked bar chart so the net change reads at a glance.
 */
export function PipelineFlowChart({ buckets }: { buckets: PipelineHistoryBucket[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reducedMotion = usePrefersReducedMotion();

  // Recharts stacks bars by sign — render closed amounts as negative numbers
  // so they render below the axis and added stays above.
  const data = buckets.map(b => ({
    label: b.label,
    added: b.addedAmount,
    closedWon: -b.closedWonAmount,
    closedLost: -b.closedLostAmount,
  }));

  return (
    <div className="h-[260px] w-full">
      {mounted ? (
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} stackOffset="sign">
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
            />
            <YAxis
              tickFormatter={(v) => fmt(Math.abs(Number(v)))}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                boxShadow: "var(--shadow-popover)",
              }}
              labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
              formatter={(v, name) => [
                fmt(Math.abs(Number(v))),
                name === "added"
                  ? "Added"
                  : name === "closedWon"
                    ? "Closed-won"
                    : "Closed-lost",
              ]}
            />
            <Bar
              dataKey="added"
              fill="var(--color-primary)"
              stackId="flow"
              radius={[4, 4, 0, 0]}
              maxBarSize={42}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="closedWon"
              fill="var(--color-success, #16a34a)"
              stackId="flow"
              radius={[0, 0, 4, 4]}
              maxBarSize={42}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
              animationBegin={80}
            />
            <Bar
              dataKey="closedLost"
              fill="var(--color-danger, #dc2626)"
              stackId="flow"
              radius={[0, 0, 4, 4]}
              maxBarSize={42}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
              animationBegin={160}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="square"
              formatter={(v) =>
                v === "added"
                  ? "Added"
                  : v === "closedWon"
                    ? "Closed-won"
                    : "Closed-lost"
              }
              wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full rounded-lg bg-accent/30" />
      )}
    </div>
  );
}
