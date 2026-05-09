"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PipelineHistoryBucket } from "@/lib/marketing/pipeline-history";
import { formatCurrency } from "@/lib/utils";

const fmt = (v: number) => formatCurrency(v, { compact: true });

/**
 * Cumulative open pipeline value at the end of each bucket — line chart with
 * unweighted + weighted series. Stacked above the flow chart.
 */
export function CumulativePipelineChart({ buckets }: { buckets: PipelineHistoryBucket[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="h-[260px] w-full">
      {mounted ? (
        <ResponsiveContainer>
          <LineChart data={buckets} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
                fmt(Number(v)),
                name === "openUnweighted" ? "Unweighted" : "Weighted",
              ]}
            />
            <Line
              type="monotone"
              dataKey="openUnweighted"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={650}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="openWeighted"
              stroke="var(--color-border-strong)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={650}
              animationEasing="ease-out"
              animationBegin={120}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="plainline"
              formatter={(v) => (v === "openUnweighted" ? "Unweighted" : "Weighted")}
              wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
            />
          </LineChart>
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
              animationDuration={550}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="closedWon"
              fill="var(--color-success, #16a34a)"
              stackId="flow"
              radius={[0, 0, 4, 4]}
              maxBarSize={42}
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
