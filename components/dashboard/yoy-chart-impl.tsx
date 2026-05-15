"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

export type YoyPoint = {
  bucket: string;
  current: number;
  prior: number;
};

/**
 * Side-by-side bar chart comparing the selected period to the same window
 * one year prior. Toggles between dollars and units. Bucket size is decided
 * upstream based on the date range.
 */
export function SalesByDurationChart({
  data,
  unitsData,
  compareLabel = "Prior Year",
}: {
  data: YoyPoint[];
  unitsData: YoyPoint[];
  /** Used for the chart legend + tooltip series name. */
  compareLabel?: string;
}) {
  const [metric, setMetric] = useState<"dollars" | "units">("dollars");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reducedMotion = usePrefersReducedMotion();
  const series = metric === "dollars" ? data : unitsData;
  const fmt = metric === "dollars"
    ? (v: number) => formatCurrency(v, { compact: true })
    : (v: number) => formatNumber(v, { compact: true });

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs font-medium">
          {(["dollars", "units"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                metric === m ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {m === "dollars" ? "Dollars" : "Units"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[280px] w-full">
        {mounted ? (
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="bucket"
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
                cursor={{ fill: "color-mix(in oklab, var(--color-primary) 8%, transparent)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "var(--shadow-popover)",
                }}
                labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
                formatter={(v, name) => [fmt(Number(v)), name === "current" ? "Selected period" : compareLabel]}
              />
              <Bar
                dataKey="prior"
                fill="var(--chart-purple-8)"
                radius={[4, 4, 0, 0]}
                maxBarSize={42}
                isAnimationActive={!reducedMotion}
                animationDuration={550}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="current"
                fill="var(--chart-purple-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={42}
                isAnimationActive={!reducedMotion}
                animationDuration={550}
                animationEasing="ease-out"
                animationBegin={100}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-accent/30" />
        )}
      </div>
      <div className="mt-3 flex items-center gap-5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="block h-2.5 w-2.5 rounded-sm"
            style={{ background: "var(--chart-purple-1)" }}
          />
          <span className="text-foreground-soft">Selected period</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="block h-2.5 w-2.5 rounded-sm"
            style={{ background: "var(--chart-purple-8)" }}
          />
          <span className="text-foreground-soft">{compareLabel}</span>
        </div>
      </div>
    </div>
  );
}

