"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const fmt = (v: number) => formatCurrency(v, { compact: true });

export type MonthlyPosReceivedPoint = {
  label: string;
  actual: number | null;
  target: number | null;
  isYear2026: boolean;
};

type TooltipPayloadItem = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
  payload?: MonthlyPosReceivedPoint;
};

function MonthlyPosTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const actual = point.actual;
  const target = point.target;
  const showVariance =
    point.isYear2026 &&
    typeof actual === "number" &&
    typeof target === "number" &&
    target !== 0;
  const delta = showVariance ? (actual as number) - (target as number) : 0;
  const pct = showVariance ? (delta / (target as number)) * 100 : 0;
  const deltaColor =
    delta >= 0 ? "var(--color-success)" : "var(--color-danger)";

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
              background: point.isYear2026
                ? "var(--color-success)"
                : "var(--color-primary)",
              display: "inline-block",
            }}
          />
          Actual
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-foreground)" }}>
          {typeof actual === "number" ? fmt(actual) : "—"}
        </span>
      </div>
      {point.isYear2026 && typeof target === "number" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 4,
            color: "var(--color-foreground-soft)",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "var(--color-warning, var(--color-danger))",
                display: "inline-block",
              }}
            />
            Target
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-foreground)" }}>
            {fmt(target)}
          </span>
        </div>
      )}
      {showVariance && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px solid var(--color-border)",
            color: deltaColor,
            fontWeight: 600,
          }}
        >
          <span>Variance</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {delta >= 0 ? "+" : ""}
            {fmt(delta)} ({delta >= 0 ? "+" : ""}
            {pct.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}

export function MonthlyPosReceivedChart({
  points,
}: {
  points: MonthlyPosReceivedPoint[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="h-[280px] w-full">
      {mounted ? (
        <ResponsiveContainer>
          <ComposedChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval={0}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<MonthlyPosTooltip />} cursor={{ fill: "var(--color-border)", opacity: 0.25 }} />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="square"
              wrapperStyle={{ fontSize: 12, color: "var(--color-foreground-soft)" }}
              formatter={(v) => (v === "actual" ? "Actual" : "2026 Target")}
            />
            <Bar
              dataKey="actual"
              maxBarSize={32}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
              animationEasing="ease-out"
            >
              {points.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.isYear2026 ? "var(--color-success)" : "var(--color-primary)"}
                />
              ))}
              <LabelList
                dataKey="actual"
                position="top"
                formatter={(v: unknown) =>
                  v === null || v === undefined ? "" : fmt(Number(v))
                }
                fontSize={10}
                fill="var(--color-foreground)"
              />
            </Bar>
            <Line
              dataKey="target"
              stroke="var(--color-warning, var(--color-danger))"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-warning, var(--color-danger))" }}
              connectNulls={false}
              isAnimationActive={!reducedMotion}
              animationDuration={550}
            >
              <LabelList
                dataKey="target"
                position="top"
                formatter={(v: unknown) =>
                  v === null || v === undefined ? "" : fmt(Number(v))
                }
                fontSize={10}
                fill="var(--color-warning, var(--color-danger))"
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full rounded-lg bg-accent/30" />
      )}
    </div>
  );
}
