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
  const series = metric === "dollars" ? data : unitsData;
  const fmt = metric === "dollars"
    ? (v: number) => formatCurrency(v, { compact: true })
    : (v: number) => formatNumber(v, { compact: true });

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <div
          role="group"
          aria-label="Chart metric"
          className="inline-flex rounded-lg border-2 border-border-strong bg-card p-1 text-base font-semibold"
        >
          {(["dollars", "units"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={cn(
                "rounded-md px-4 py-2 transition-colors",
                metric === m ? "bg-primary text-primary-foreground" : "text-foreground-soft hover:text-foreground hover:bg-accent",
              )}
            >
              {m === "dollars" ? "Dollars" : "Units"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[320px] w-full">
        {mounted ? (
          <ResponsiveContainer>
            <BarChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fill: "var(--color-muted)", fontSize: 14, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border-strong)" }}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fill: "var(--color-muted)", fontSize: 14, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--color-primary) 10%, transparent)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "2px solid var(--color-border-strong)",
                  borderRadius: 8,
                  fontSize: 15,
                  padding: "8px 12px",
                  boxShadow: "var(--shadow-popover)",
                }}
                labelStyle={{ color: "var(--color-foreground)", fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ color: "var(--color-foreground-soft)" }}
                formatter={(v, name) => [fmt(Number(v)), name === "current" ? "Selected period" : compareLabel]}
              />
              <Bar dataKey="prior" fill="var(--color-border-strong)" radius={[4, 4, 0, 0]} maxBarSize={42} />
              <Bar dataKey="current" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-accent/30" />
        )}
      </div>
      <div className="mt-4 flex items-center gap-6 text-base">
        <div className="flex items-center gap-2">
          <span className="block h-3.5 w-3.5 rounded-sm bg-primary" />
          <span className="text-foreground font-semibold">Selected period</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="block h-3.5 w-3.5 rounded-sm"
            style={{ background: "var(--color-border-strong)" }}
          />
          <span className="text-foreground font-semibold">{compareLabel}</span>
        </div>
      </div>
    </div>
  );
}

/** Back-compat alias so existing imports keep working through the rename. */
export const YoyChart = SalesByDurationChart;
