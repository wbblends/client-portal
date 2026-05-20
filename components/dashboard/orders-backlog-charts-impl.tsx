"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
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
];

const WEEKLY_BACKLOG: Array<{ label: string; value: number }> = [
  { label: "Feb 23", value: 29_170_124 },
  { label: "Mar 2",  value: 26_423_867 },
  { label: "Mar 9",  value: 27_271_565 },
  { label: "Mar 16", value: 29_306_520 },
  { label: "Mar 23", value: 30_435_495 },
  { label: "Apr 3",  value: 27_286_570 },
  { label: "Apr 9",  value: 27_489_483 },
  { label: "Apr 16", value: 28_796_650 },
  { label: "Apr 24", value: 30_376_233 },
  { label: "May 1",  value: 27_705_627 },
  { label: "May 8",  value: 33_925_675 },
  { label: "May 15", value: 33_900_000 },
];

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

export function BacklogWeeklyChart() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <LineChart data={WEEKLY_BACKLOG} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
          <Tooltip content={<BacklogTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-primary)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={!reducedMotion}
            animationDuration={550}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
