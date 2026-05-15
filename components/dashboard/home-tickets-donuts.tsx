"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

type Datum = { name: string; value: number };

const SECTION_PALETTE = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "#0a66c2",
  "var(--color-muted)",
  "var(--color-border-strong)",
];

const HEALTH_COLORS: Record<string, string> = {
  Overdue: "var(--color-danger)",
  Parked: "var(--color-muted)",
  "On track": "var(--color-success)",
};

const TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "var(--shadow-popover)",
} as const;

function Donut({
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
  if (total === 0) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center text-sm text-muted">
        No tickets yet.
      </div>
    );
  }
  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="92%"
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
        <div className="font-display text-[24px] tabular-nums tracking-tight text-foreground">
          {formatNumber(total)}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {centerLabel}
        </div>
      </div>
    </div>
  );
}

export function HomeTicketsDonuts({
  bySection,
  health,
}: {
  bySection: Datum[];
  health: Datum[];
}) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Donut
        data={bySection}
        colors={SECTION_PALETTE}
        centerLabel="open"
        reducedMotion={reducedMotion}
      />
      <Donut
        data={health}
        colors={health.map(d => HEALTH_COLORS[d.name] ?? "var(--color-muted)")}
        centerLabel="open"
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
