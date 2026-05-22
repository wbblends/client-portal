"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type {
  DealCard,
  DealFormat,
  DealTier,
  KanbanData,
  PipelineKey,
} from "@/lib/marketing/hubspot";
import { CompanyLogo, DealNotesModal } from "./deal-card";

type Scope = "combined" | "sales" | "expansion";
type Weight = "unweighted" | "weighted";

type FlatDeal = DealCard & {
  pipelineKey: PipelineKey;
  pipelineLabel: string;
  stageLabel: string;
};

const SCOPE_LABEL: Record<Scope, string> = {
  combined: "Combined Pipelines",
  sales: "New Logo Pipeline",
  expansion: "Wallet Share Pipeline",
};

const TIER_ORDER = ["AA", "A", "B", "C", "Unset"] as const;
const FORMAT_ORDER = ["Liquid", "Capsule", "Powder", "Unset"] as const;
// Union of stage labels across both pipelines in their natural progression
// order. Each pipeline only uses a subset; the orderHint logic pushes any
// unexpected labels to the end alphabetically, so this stays correct if HubSpot
// adds a stage we haven't listed.
const STAGE_ORDER = [
  "Target",
  "In Contact",
  "Opportunity",
  "Formulation",
  "Quoting",
  "R&D",
  "Onboarding",
] as const;
const STALE_AFTER_DAYS = 30;
const STALE_TOP_N = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// Curated palette for donut slices — eight shades of the WB Blends brand
// purple, with lightness alternating on purpose so adjacent slices stay
// distinguishable when many categories are visible. The two trailing
// neutrals are reserved for "Unset/Unknown" buckets so a missing value
// reads as "missing" rather than as another category. Sourced from the
// --chart-purple-*/--chart-neutral-* tokens in globals.css so light and
// dark mode get tonally appropriate variants.
const SLICE_COLORS = [
  "var(--chart-purple-1)",  // brand primary
  "var(--chart-purple-2)",  // mid-light lavender
  "var(--chart-purple-3)",  // deep purple
  "var(--chart-purple-4)",  // light lavender
  "var(--chart-purple-5)",  // mid-deep
  "var(--chart-purple-6)",  // mid-light alt
  "var(--chart-purple-7)",  // very deep
  "var(--chart-purple-8)",  // palest lavender
  "var(--chart-neutral-1)", // fallback for "Unset/Unknown"
  "var(--chart-neutral-2)", // secondary fallback
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

/** Humanize HubSpot's hs_analytics_source SCREAMING_SNAKE_CASE into something
 *  the user can read. Null/empty values bucket under "Unknown". */
function humanizeSource(s: string | null): string {
  if (!s) return "Unknown";
  return s
    .toLowerCase()
    .split("_")
    .map(w => (w === "" ? "" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

export function PipelineAnalyticsView({ data }: { data: KanbanData }) {
  const [scope, setScope] = useState<Scope>("combined");
  const [chartWeight, setChartWeight] = useState<Weight>("unweighted");

  const allOpen = useMemo(() => flatten(data), [data]);
  const deals = useMemo(() => allOpen.filter(d => inScope(d, scope)), [allOpen, scope]);

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

      <div className="grid grid-cols-1 gap-5 sm:gap-7 xl:grid-cols-2">
        <DonutCard
          title="Deals by Stage"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.stageLabel}
          orderHint={STAGE_ORDER}
        />
        <DonutCard
          title="Deals by Rep"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.owner?.name ?? "Unassigned"}
          orderHint={null}
        />
        <DonutCard
          title="Deals by Tier"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.tier ?? "Unset"}
          orderHint={TIER_ORDER}
        />
        <DonutCard
          title="Deals by Format"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => d.format ?? "Unset"}
          orderHint={FORMAT_ORDER}
        />
        <DonutCard
          title="Deals by Source"
          deals={deals}
          weight={chartWeight}
          onWeightChange={setChartWeight}
          groupBy={d => humanizeSource(d.source)}
          orderHint={null}
        />
      </div>

      <BreakdownTable
        title="By Stage"
        deals={deals}
        groupBy={d => d.stageLabel}
        orderHint={STAGE_ORDER}
      />
      <BreakdownTable
        title="By Rep"
        deals={deals}
        groupBy={d => d.owner?.name ?? "Unassigned"}
        orderHint={null}
      />
      <BreakdownTable
        title="By Tier"
        deals={deals}
        groupBy={d => d.tier ?? "Unset"}
        orderHint={TIER_ORDER}
      />
      <BreakdownTable
        title="By Format"
        deals={deals}
        groupBy={d => d.format ?? "Unset"}
        orderHint={FORMAT_ORDER}
      />
      <BreakdownTable
        title="By Source"
        deals={deals}
        groupBy={d => humanizeSource(d.source)}
        orderHint={null}
      />

      <AgingCard deals={deals} />
    </div>
  );
}

// ─── Scope toggle ────────────────────────────────────────────────────────────

function ScopeToggle({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const options: { key: Scope; label: string }[] = [
    { key: "combined", label: "Combined Pipelines" },
    { key: "sales", label: "New Logo Pipeline" },
    { key: "expansion", label: "Wallet Share Pipeline" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Pipeline scope"
      className="inline-flex flex-wrap rounded-lg border border-border bg-card p-0.5 shadow-sm"
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
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-[26px] tabular-nums tracking-tight text-foreground">
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
  deals,
  groupBy,
  orderHint,
}: {
  title: string;
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
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
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
    // Palette shape: indices 0–7 are the purple ramp, 8–9 are neutral
    // fallbacks for "missing data" buckets. Real categories rotate through
    // the eight purples; Unset/Unassigned/Unknown drop into a neutral so
    // they read visually as "no value" rather than as another category.
    const PURPLE_COUNT = 8;
    let neutralCursor = 0;
    return sorted.map((r, i) => {
      const isMissing =
        r.key === "Unset" || r.key === "Unassigned" || r.key === "Unknown";
      const color = isMissing
        ? SLICE_COLORS[PURPLE_COUNT + (neutralCursor++ % 2)]
        : SLICE_COLORS[i % PURPLE_COUNT];
      return {
        key: r.key,
        value: valueOf(r),
        pct: valueOf(r) / total,
        color,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, total, weight]);

  return (
    <Card className="px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
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
  // a circumference of ~263.9px which makes the math intuitive; each slice
  // starts at the prefix sum of preceding lengths, precomputed once below so
  // the render stays a pure map (no closure mutation across iterations).
  const r = 42;
  const C = 2 * Math.PI * r;
  const offsets = slices.map((_, i) =>
    slices.slice(0, i).reduce((sum, prev) => sum + prev.pct * C, 0),
  );

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
        {slices.map((s, i) => {
          const len = s.pct * C;
          return (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="12"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offsets[i]}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Total</div>
        <div className="text-sm font-semibold tabular-nums text-foreground">{fmtMoney(total)}</div>
      </div>
    </div>
  );
}

function WeightToggle({ value, onChange }: { value: Weight; onChange: (w: Weight) => void }) {
  const opts: { key: Weight; label: string }[] = [
    { key: "unweighted", label: "Unweighted" },
    { key: "weighted", label: "Weighted" },
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
              "px-2.5 py-0.5 rounded-sm font-medium transition-colors " +
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
  return Math.floor((Date.now() - ms) / DAY_MS);
}

function AgingCard({ deals }: { deals: FlatDeal[] }) {
  const withAge = useMemo(() => {
    return deals
      .map(d => ({ deal: d, days: daysSince(d.lastModified) }))
      .filter((x): x is { deal: FlatDeal; days: number } => x.days !== null && x.days >= STALE_AFTER_DAYS)
      .sort((a, b) => b.days - a.days);
  }, [deals]);

  const totalStaleValue = withAge.reduce((s, x) => s + x.deal.amount, 0);
  const shown = withAge.slice(0, STALE_TOP_N);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground">
            Stale Deals
          </h3>
          <span className="text-xs text-muted">
            No activity in {STALE_AFTER_DAYS}+ days · {withAge.length} deal{withAge.length === 1 ? "" : "s"} ·{" "}
            {fmtMoney(totalStaleValue)}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="px-5 pb-5 text-sm text-muted">Nothing stale right now — nice.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
                <th className="px-5 py-2.5 text-left font-semibold">Deal</th>
                <th className="px-3 py-2.5 text-left font-semibold">Rep</th>
                <th className="px-3 py-2.5 text-left font-semibold">Stage</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-5 py-2.5 text-right font-semibold">Stale for</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ deal, days }, idx) => (
                <StaleDealRow
                  key={deal.id}
                  deal={deal}
                  days={days}
                  zebra={idx % 2 === 1}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** One row of the Stale Deals table. Clicking opens the same notes modal the
 *  pipeline cards use, so the rep can add a follow-up note without leaving the
 *  analytics page. Local state mirrors what DealCardView keeps so an inline
 *  amount/tier/format edit in the modal reflects in the row immediately. */
function StaleDealRow({
  deal,
  days,
  zebra,
}: {
  deal: FlatDeal;
  days: number;
  zebra: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<DealTier | null>(deal.tier);
  const [format, setFormat] = useState<DealFormat | null>(deal.format);
  const [amount, setAmount] = useState<number>(deal.amount);

  return (
    <>
      <tr
        onClick={() => setOpen(true)}
        className={
          "border-b border-border last:border-b-0 cursor-pointer transition-colors " +
          "hover:bg-primary/5 " +
          (zebra ? "bg-surface/30" : "")
        }
      >
        <td className="px-5 py-3 max-w-[360px]">
          <div className="flex items-start gap-2.5">
            {deal.companyDomain ? (
              <CompanyLogo domain={deal.companyDomain} name={deal.companyName} />
            ) : (
              <div className="shrink-0 h-6 w-6 rounded bg-surface border border-border" />
            )}
            <div className="min-w-0">
              <div className="text-foreground font-medium truncate" title={deal.name}>
                {deal.name}
              </div>
              {deal.companyName && deal.companyName !== deal.name && (
                <div className="text-xs text-muted truncate" title={deal.companyName}>
                  {deal.companyName}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-foreground-soft">{deal.owner?.name ?? "Unassigned"}</td>
        <td className="px-3 py-3 text-foreground-soft">{deal.stageLabel}</td>
        <td className="px-3 py-3 text-right tabular-nums text-foreground">{fmtMoney(amount)}</td>
        <td className="px-5 py-3 text-right tabular-nums text-warning">{days}d</td>
      </tr>

      {open && (
        <DealNotesModal
          deal={{ ...deal, tier, format, amount }}
          tier={tier}
          format={format}
          amount={amount}
          onChange={next => {
            if (next.tier !== undefined) setTier(next.tier);
            if (next.format !== undefined) setFormat(next.format);
            if (next.amount !== undefined) setAmount(next.amount);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
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
