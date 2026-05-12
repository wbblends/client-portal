"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { DealCard, KanbanData, PipelineKey } from "@/lib/marketing/hubspot";

type Scope = "combined" | "sales" | "expansion";
type Weight = "unweighted" | "weighted";

type FlatDeal = DealCard & {
  pipelineKey: PipelineKey;
  pipelineLabel: string;
  stageLabel: string;
};

const SCOPE_LABEL: Record<Scope, string> = {
  combined: "Combined",
  sales: "Sales Pipeline",
  expansion: "Account Expansion",
};

const TIER_ORDER = ["AA", "A", "B", "C", "Unset"] as const;
const FORMAT_ORDER = ["Liquid", "Capsule", "Powder", "Unset"] as const;
const STALE_AFTER_DAYS = 30;

// Curated palette for donut slices — chosen to remain legible on both the
// light surface (#f6f4ff) and the dark card surface, with adjacent colors
// kept distinguishable when more than five slices are visible. Slices beyond
// the palette length cycle back to index 0.
const SLICE_COLORS = [
  "#6e5bfe", // primary purple
  "#14854c", // success green
  "#b45309", // warning amber
  "#4338ca", // info indigo
  "#db2777", // pink
  "#0891b2", // cyan
  "#65a30d", // lime
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0d9488", // teal
  "#b91c1c", // danger red
  "#475569", // slate (fallback for "Unset")
];

function flatten(data: KanbanData): FlatDeal[] {
  const out: FlatDeal[] = [];
  for (const p of data.pipelines) {
    for (const s of p.stages) {
      if (s.isClosed) continue;
      for (const d of s.deals) {
        out.push({
          ...d,
          pipelineKey: p.key,
          pipelineLabel: p.label,
          stageLabel: s.label,
        });
      }
    }
  }
  return out;
}

function inScope(d: FlatDeal, scope: Scope): boolean {
  if (scope === "combined") return true;
  return d.pipelineKey === scope;
}

export function PipelineAnalyticsView({ data }: { data: KanbanData }) {
  const [scope, setScope] = useState<Scope>("combined");
  const [chartWeight, setChartWeight] = useState<Weight>("unweighted");

  const allDeals = useMemo(() => flatten(data), [data]);
  const deals = useMemo(() => allDeals.filter(d => inScope(d, scope)), [allDeals, scope]);

  const totals = useMemo(() => {
    let unweighted = 0;
    let weighted = 0;
    for (const d of deals) {
      unweighted += d.amount;
      weighted += d.weighted;
    }
    return { unweighted, weighted, count: deals.length };
  }, [deals]);

  return (
    <div className="space-y-5 sm:space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScopeToggle value={scope} onChange={setScope} />
        <div className="text-xs text-muted">
          {totals.count.toLocaleString()} open deals · {SCOPE_LABEL[scope]}
        </div>
      </div>

      <SummaryStrip totals={totals} />

      <div className="grid grid-cols-1 gap-5 sm:gap-7 xl:grid-cols-3">
        <DonutCard
          title="Makeup by rep"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.owner?.name ?? "Unassigned"}
          // No fixed order — sort by value descending in the buildBuckets call.
          orderHint={null}
        />
        <DonutCard
          title="Makeup by tier"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.tier ?? "Unset"}
          orderHint={TIER_ORDER}
        />
        <DonutCard
          title="Makeup by format"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.format ?? "Unset"}
          orderHint={FORMAT_ORDER}
        />
      </div>

      <BreakdownTable
        title="By rep"
        description="Open deals, pipeline value, and weighted value per HubSpot owner."
        deals={deals}
        groupBy={d => d.owner?.name ?? "Unassigned"}
        orderHint={null}
      />
      <BreakdownTable
        title="By tier"
        description="Deal volume and value grouped by customer tier."
        deals={deals}
        groupBy={d => d.tier ?? "Unset"}
        orderHint={TIER_ORDER}
      />
      <BreakdownTable
        title="By format"
        description="Deal volume and value grouped by product format."
        deals={deals}
        groupBy={d => d.format ?? "Unset"}
        orderHint={FORMAT_ORDER}
      />

      <AgingCard deals={deals} />
    </div>
  );
}

// ─── Scope toggle ────────────────────────────────────────────────────────────

function ScopeToggle({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const options: { key: Scope; label: string }[] = [
    { key: "combined", label: "Combined" },
    { key: "sales", label: "Sales" },
    { key: "expansion", label: "Expansion" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Pipeline scope"
      className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-sm"
    >
      {options.map(opt => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors " +
              (active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground-soft hover:bg-accent")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Summary strip ───────────────────────────────────────────────────────────

function SummaryStrip({
  totals,
}: {
  totals: { unweighted: number; weighted: number; count: number };
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <SummaryCell label="Open deals" primary={totals.count.toLocaleString()} />
        <SummaryCell label="Unweighted pipeline" primary={fmtMoney(totals.unweighted)} />
        <SummaryCell label="Weighted pipeline" primary={fmtMoney(totals.weighted)} />
      </div>
    </Card>
  );
}

function SummaryCell({ label, primary }: { label: string; primary: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight text-foreground">
        {primary}
      </div>
    </div>
  );
}

// ─── Breakdown tables ────────────────────────────────────────────────────────

type Bucket = {
  key: string;
  count: number;
  unweighted: number;
  weighted: number;
};

function buildBuckets(
  deals: FlatDeal[],
  groupBy: (d: FlatDeal) => string,
  orderHint: readonly string[] | null,
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const d of deals) {
    const key = groupBy(d);
    const b = map.get(key) ?? { key, count: 0, unweighted: 0, weighted: 0 };
    b.count += 1;
    b.unweighted += d.amount;
    b.weighted += d.weighted;
    map.set(key, b);
  }
  const rows = Array.from(map.values());
  if (orderHint) {
    // Honor the supplied order for stable lists like tiers/formats, but push
    // any unexpected keys to the end alphabetically.
    const hint = new Map(orderHint.map((k, i) => [k, i]));
    rows.sort((a, b) => {
      const ai = hint.get(a.key);
      const bi = hint.get(b.key);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.key.localeCompare(b.key);
    });
  } else {
    rows.sort((a, b) => b.unweighted - a.unweighted);
  }
  return rows;
}

function BreakdownTable({
  title,
  description,
  deals,
  groupBy,
  orderHint,
}: {
  title: string;
  description: string;
  deals: FlatDeal[];
  groupBy: (d: FlatDeal) => string;
  orderHint: readonly string[] | null;
}) {
  const rows = useMemo(() => buildBuckets(deals, groupBy, orderHint), [deals, groupBy, orderHint]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.count += r.count;
          acc.unweighted += r.unweighted;
          acc.weighted += r.weighted;
          return acc;
        },
        { count: 0, unweighted: 0, weighted: 0 },
      ),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <Card className="px-5 py-6 text-sm text-muted">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <p className="mt-1">No deals in this scope.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm text-muted mt-0.5">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
              <th className="px-5 py-2.5 text-left font-semibold">{title.replace(/^By\s/, "")}</th>
              <th className="px-3 py-2.5 text-right font-semibold">Open</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unweighted</th>
              <th className="px-3 py-2.5 text-right font-semibold">Weighted</th>
              <th className="px-5 py-2.5 text-right font-semibold">Avg deal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.key}
                className={`border-b border-border last:border-b-0 ${idx % 2 === 1 ? "bg-surface/30" : ""}`}
              >
                <td className="px-5 py-3 text-foreground font-medium">{r.key}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{r.count}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">
                  {fmtMoney(r.unweighted)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">
                  {fmtMoney(r.weighted)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-foreground">
                  {r.count > 0 ? fmtMoney(r.unweighted / r.count) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong/70 bg-surface/60">
              <td className="px-5 py-3 text-sm font-semibold text-foreground">Total</td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {totals.count}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {fmtMoney(totals.unweighted)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {fmtMoney(totals.weighted)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {totals.count > 0 ? fmtMoney(totals.unweighted / totals.count) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ─── Donut chart ─────────────────────────────────────────────────────────────

function DonutCard({
  title,
  deals,
  weight,
  onWeightChange,
  groupBy,
  orderHint,
}: {
  title: string;
  deals: FlatDeal[];
  weight: Weight;
  onWeightChange: (w: Weight) => void;
  groupBy: (d: FlatDeal) => string;
  orderHint: readonly string[] | null;
}) {
  const rows = useMemo(() => buildBuckets(deals, groupBy, orderHint), [deals, groupBy, orderHint]);
  const valueOf = (b: Bucket) => (weight === "weighted" ? b.weighted : b.unweighted);
  const total = rows.reduce((s, r) => s + valueOf(r), 0);

  const slices = useMemo(() => {
    if (total <= 0) return [] as { key: string; value: number; pct: number; color: string }[];
    // Render the donut in value-descending order so the largest slice starts
    // at the top, regardless of how the table is sorted.
    const sorted = [...rows].sort((a, b) => valueOf(b) - valueOf(a));
    return sorted.map((r, i) => ({
      key: r.key,
      value: valueOf(r),
      pct: valueOf(r) / total,
      color:
        r.key === "Unset" || r.key === "Unassigned"
          ? SLICE_COLORS[SLICE_COLORS.length - 1]
          : SLICE_COLORS[i % (SLICE_COLORS.length - 1)],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, total, weight]);

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <WeightToggle value={weight} onChange={onWeightChange} />
      </div>

      {total <= 0 ? (
        <div className="mt-6 text-sm text-muted">No data in this scope.</div>
      ) : (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Donut slices={slices} total={total} />
          <ul className="flex-1 space-y-1.5 text-sm">
            {slices.map(s => (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-foreground-soft flex-1" title={s.key}>
                  {s.key}
                </span>
                <span className="tabular-nums text-muted text-xs">{(s.pct * 100).toFixed(1)}%</span>
                <span className="tabular-nums text-foreground font-medium text-xs">
                  {fmtMoney(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Donut({
  slices,
  total,
}: {
  slices: { key: string; value: number; pct: number; color: string }[];
  total: number;
}) {
  // SVG donut built with stroke-dasharray on a single circle path. r=42 gives
  // a circumference of ~263.9px which makes the math intuitive; sliceLen =
  // pct × C, gap accumulates per slice via stroke-dashoffset.
  const r = 42;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative shrink-0">
      <svg
        viewBox="0 0 100 100"
        className="h-32 w-32 sm:h-36 sm:w-36 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="12"
        />
        {slices.map(s => {
          const len = s.pct * C;
          const dash = `${len} ${C - len}`;
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] uppercase tracking-wide text-muted">Total</div>
        <div className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(total)}</div>
      </div>
    </div>
  );
}

function WeightToggle({ value, onChange }: { value: Weight; onChange: (w: Weight) => void }) {
  const opts: { key: Weight; label: string }[] = [
    { key: "unweighted", label: "Unwtd" },
    { key: "weighted", label: "Wtd" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
      {opts.map(o => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={
              "px-2 py-0.5 rounded-sm font-medium transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-foreground-soft hover:bg-accent")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Aging ───────────────────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

function AgingCard({ deals }: { deals: FlatDeal[] }) {
  const withAge = useMemo(() => {
    return deals
      .map(d => ({ deal: d, days: daysSince(d.lastModified) }))
      .filter((x): x is { deal: FlatDeal; days: number } => x.days !== null && x.days >= STALE_AFTER_DAYS)
      .sort((a, b) => b.days - a.days);
  }, [deals]);

  const totalStaleValue = withAge.reduce((s, x) => s + x.deal.amount, 0);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Stale deals
          </h3>
          <span className="text-xs text-muted">
            No activity in {STALE_AFTER_DAYS}+ days · {withAge.length} deal{withAge.length === 1 ? "" : "s"} ·{" "}
            {fmtMoney(totalStaleValue)}
          </span>
        </div>
        <p className="text-sm text-muted mt-0.5">
          Open deals whose HubSpot record hasn&apos;t been modified in over {STALE_AFTER_DAYS} days. Top 10 shown.
        </p>
      </div>

      {withAge.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted">Nothing stale right now — nice.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
                <th className="px-5 py-2.5 text-left font-semibold">Deal</th>
                <th className="px-3 py-2.5 text-left font-semibold">Rep</th>
                <th className="px-3 py-2.5 text-left font-semibold">Stage</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-2.5 text-right font-semibold">Stale for</th>
              </tr>
            </thead>
            <tbody>
              {withAge.slice(0, 10).map(({ deal, days }, idx) => (
                <tr
                  key={deal.id}
                  className={`border-b border-border last:border-b-0 ${idx % 2 === 1 ? "bg-surface/30" : ""}`}
                >
                  <td className="px-5 py-3 max-w-[320px]">
                    <a
                      href={deal.hubspotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-primary underline-offset-2 hover:underline truncate block"
                      title={deal.name}
                    >
                      {deal.name}
                    </a>
                    {deal.companyName && (
                      <div className="text-xs text-muted truncate" title={deal.companyName}>
                        {deal.companyName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-foreground-soft">{deal.owner?.name ?? "Unassigned"}</td>
                  <td className="px-3 py-3 text-foreground-soft">{deal.stageLabel}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {fmtMoney(deal.amount)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-warning">
                    {days}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Money formatting ────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}mm`;
  }
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}
