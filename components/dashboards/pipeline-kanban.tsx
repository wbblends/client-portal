import { Fragment } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getPipelineKanban,
  type KanbanData,
  type PipelineKanban,
  type StageColumn,
  type DealCard,
  type DealTier,
  type DealFormat,
} from "@/lib/marketing/hubspot";

export async function PipelineKanbanDashboard() {
  const data = await getPipelineKanban();
  const summary = computeOverallSummary(data);

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">Sales</p>
          <h1 className="mt-0.5 font-display text-[clamp(26px,4.2vw,34px)] leading-[1.1] tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="mt-1 max-w-[640px] text-sm text-muted">
            Open deals across both HubSpot pipelines, grouped by stage. Click any card to open the deal in HubSpot.
          </p>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      {/* Top-line totals */}
      <SummaryStrip summary={summary} />

      <RepSummary data={data} />

      {data.pipelines.map(p => (
        <PipelineSection key={p.key} pipeline={p} />
      ))}
    </div>
  );
}

type StageCount = { label: string; count: number };
type PipelineBreakdown = { pipelineKey: string; pipelineLabel: string; stages: StageCount[] };

type RepTotal = {
  id: string;
  name: string;
  initials: string;
  salesCount: number;
  expansionCount: number;
  unweighted: number;
  weighted: number;
  byPipeline: PipelineBreakdown[];
};

type Totals = {
  salesCount: number;
  expansionCount: number;
  unweighted: number;
  weighted: number;
};

function computeRepTotals(data: KanbanData): { rows: RepTotal[]; totals: Totals } {
  // ownerKey → pipelineKey → stageLabel → count
  const stageCounts = new Map<string, Map<string, Map<string, number>>>();
  const baseMap = new Map<string, RepTotal>();
  const totals: Totals = { salesCount: 0, expansionCount: 0, unweighted: 0, weighted: 0 };

  for (const p of data.pipelines) {
    for (const stage of p.stages) {
      for (const deal of stage.deals) {
        const ownerKey = deal.owner?.id ?? "__unassigned__";
        const existing = baseMap.get(ownerKey) ?? {
          id: ownerKey,
          name: deal.owner?.name ?? "Unassigned",
          initials: deal.owner?.initials ?? "—",
          salesCount: 0,
          expansionCount: 0,
          unweighted: 0,
          weighted: 0,
          byPipeline: [],
        };
        if (p.key === "sales") existing.salesCount += 1;
        else if (p.key === "expansion") existing.expansionCount += 1;
        existing.unweighted += deal.amount;
        existing.weighted += deal.weighted;
        baseMap.set(ownerKey, existing);

        if (p.key === "sales") totals.salesCount += 1;
        else if (p.key === "expansion") totals.expansionCount += 1;
        totals.unweighted += deal.amount;
        totals.weighted += deal.weighted;

        if (!stageCounts.has(ownerKey)) stageCounts.set(ownerKey, new Map());
        const perPipeline = stageCounts.get(ownerKey)!;
        if (!perPipeline.has(p.key)) perPipeline.set(p.key, new Map());
        const perStage = perPipeline.get(p.key)!;
        perStage.set(stage.label, (perStage.get(stage.label) ?? 0) + 1);
      }
    }
  }

  // Build the byPipeline breakdown in the original pipeline-stage display order.
  const stageOrder = new Map<string, string[]>(
    data.pipelines.map(p => [p.key, p.stages.map(s => s.label)]),
  );
  const pipelineLabels = new Map<string, string>(
    data.pipelines.map(p => [p.key, p.label]),
  );

  for (const rep of baseMap.values()) {
    const reps = stageCounts.get(rep.id);
    if (!reps) continue;
    for (const p of data.pipelines) {
      const perStage = reps.get(p.key);
      if (!perStage || perStage.size === 0) continue;
      const ordered = (stageOrder.get(p.key) ?? [])
        .map(label => ({ label, count: perStage.get(label) ?? 0 }))
        .filter(s => s.count > 0);
      rep.byPipeline.push({
        pipelineKey: p.key,
        pipelineLabel: pipelineLabels.get(p.key) ?? p.key,
        stages: ordered,
      });
    }
  }

  const rows = Array.from(baseMap.values()).sort((a, b) => b.unweighted - a.unweighted);
  return { rows, totals };
}

type OverallSummary = {
  totalDeals: number;
  totalUnweighted: number;
  totalWeighted: number;
  perPipeline: { key: string; label: string; deals: number; unweighted: number; weighted: number }[];
};

function computeOverallSummary(data: KanbanData): OverallSummary {
  let totalDeals = 0;
  let totalUnweighted = 0;
  let totalWeighted = 0;
  const perPipeline: OverallSummary["perPipeline"] = [];
  for (const p of data.pipelines) {
    let deals = 0;
    let unweighted = 0;
    let weighted = 0;
    for (const stage of p.stages) {
      for (const deal of stage.deals) {
        deals += 1;
        unweighted += deal.amount;
        weighted += deal.weighted;
      }
    }
    perPipeline.push({ key: p.key, label: p.label, deals, unweighted, weighted });
    totalDeals += deals;
    totalUnweighted += unweighted;
    totalWeighted += weighted;
  }
  return { totalDeals, totalUnweighted, totalWeighted, perPipeline };
}

function SummaryStrip({ summary }: { summary: OverallSummary }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <SummaryCell
          label="Open deals"
          primary={summary.totalDeals.toLocaleString()}
          hint={summary.perPipeline
            .map(p => `${p.deals} ${shortPipelineLabel(p.label)}`)
            .join(" · ")}
        />
        <SummaryCell
          label="Unweighted pipeline"
          primary={fmtMoneyCompact(summary.totalUnweighted)}
          hint={summary.perPipeline
            .map(p => `${shortPipelineLabel(p.label)} ${fmtMoneyCompact(p.unweighted)}`)
            .join(" · ")}
        />
        <SummaryCell
          label="Weighted pipeline"
          primary={fmtMoneyCompact(summary.totalWeighted)}
          hint={summary.perPipeline
            .map(p => `${shortPipelineLabel(p.label)} ${fmtMoneyCompact(p.weighted)}`)
            .join(" · ")}
        />
      </div>
    </Card>
  );
}

function SummaryCell({ label, primary, hint }: { label: string; primary: string; hint: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums tracking-tight text-foreground">
        {primary}
      </div>
      <div className="mt-1 text-xs text-muted truncate" title={hint}>
        {hint}
      </div>
    </div>
  );
}

function shortPipelineLabel(label: string): string {
  if (label.toLowerCase().includes("sales")) return "Sales";
  if (label.toLowerCase().includes("expansion")) return "Expansion";
  return label;
}

function RepSummary({ data }: { data: KanbanData }) {
  const { rows, totals } = computeRepTotals(data);
  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">By rep</h3>
          <p className="text-sm text-muted mt-0.5">
            Open deals across both pipelines, broken down by stage. Sorted by unweighted value.
          </p>
        </div>
        <p className="text-xs text-muted">{rows.length} reps with open deals</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted border-y border-border bg-surface/60">
              <th className="px-5 py-2.5 text-left font-semibold">Rep</th>
              <th className="px-3 py-2.5 text-right font-semibold">Sales</th>
              <th className="px-3 py-2.5 text-right font-semibold">Expansion</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unweighted</th>
              <th className="px-5 py-2.5 text-right font-semibold">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rep, idx) => (
              <tr
                key={rep.id}
                className={`border-b border-border last:border-b-0 ${
                  idx % 2 === 1 ? "bg-surface/30" : ""
                }`}
              >
                <td className="px-5 py-3 align-top">
                  <div className="flex items-start gap-3 min-w-0">
                    <OwnerAvatar name={rep.name} initials={rep.initials} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate" title={rep.name}>
                        {rep.name}
                      </div>
                      {rep.byPipeline.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-1">
                          {rep.byPipeline.map(p => (
                            <StageChipRow key={p.pipelineKey} breakdown={p} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums text-foreground">
                  {rep.salesCount}
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums text-foreground">
                  {rep.expansionCount}
                </td>
                <td className="px-3 py-3 align-top text-right tabular-nums font-medium text-foreground">
                  {fmtMoneyCompact(rep.unweighted)}
                </td>
                <td className="px-5 py-3 align-top text-right tabular-nums text-muted">
                  {fmtMoneyCompact(rep.weighted)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong/70 bg-surface/60">
              <td className="px-5 py-3 text-sm font-semibold text-foreground">Total</td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {totals.salesCount}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {totals.expansionCount}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {fmtMoneyCompact(totals.unweighted)}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-sm font-semibold text-foreground">
                {fmtMoneyCompact(totals.weighted)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function StageChipRow({ breakdown }: { breakdown: PipelineBreakdown }) {
  const dotColor = breakdown.pipelineKey === "sales" ? "bg-primary" : "bg-info";
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="inline-flex items-center gap-1 text-muted font-medium uppercase tracking-wide text-[10px]">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {breakdown.pipelineLabel}
      </span>
      {breakdown.stages.map(s => (
        <Fragment key={s.label}>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-foreground-soft">
            <span className="truncate max-w-[140px]" title={s.label}>
              {s.label}
            </span>
            <span className="font-semibold text-foreground tabular-nums">{s.count}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function PipelineSection({ pipeline }: { pipeline: PipelineKanban }) {
  const total = pipeline.stages.reduce((s, st) => s + st.totalAmount, 0);
  const dealCount = pipeline.stages.reduce((s, st) => s + st.dealCount, 0);
  const dotColor = pipeline.key === "sales" ? "bg-primary" : "bg-info";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-[24px] leading-tight tracking-tight text-foreground inline-flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
          {pipeline.label}
        </h2>
        <div className="flex items-center gap-5 text-xs text-muted">
          <span>
            <span className="text-foreground font-semibold tabular-nums">{dealCount}</span>{" "}
            <span className="text-muted">open deals</span>
          </span>
          <span className="hidden sm:inline h-3 w-px bg-border" />
          <span>
            <span className="text-foreground font-semibold tabular-nums">{fmtMoneyCompact(total)}</span>{" "}
            <span className="text-muted">unweighted</span>
          </span>
        </div>
      </div>

      <div className="-mx-[clamp(1rem,3vw,2.5rem)] page-pad-x overflow-x-auto pb-3">
        <div className="flex gap-4 min-w-max">
          {pipeline.stages.map(stage => (
            <StageColumnView key={stage.id} stage={stage} pipelineKey={pipeline.key} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StageColumnView({ stage, pipelineKey }: { stage: StageColumn; pipelineKey: string }) {
  const probabilityPct = Math.round(stage.probability * 100);
  const barColor = pipelineKey === "sales" ? "bg-primary" : "bg-info";
  return (
    <div className="w-[300px] shrink-0 rounded-xl bg-surface/60 border border-border flex flex-col max-h-[720px]">
      <div className="px-3.5 pt-3.5 pb-3 border-b border-border/70">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-foreground truncate" title={stage.label}>
            {stage.label}
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted bg-card border border-border rounded-md px-1.5 py-0.5 tabular-nums">
            {stage.dealCount}
          </span>
        </div>

        {/* Probability bar — visualizes how far down the funnel each column is. */}
        <div className="mt-2.5">
          <div className="h-1 w-full rounded-full bg-border/70 overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${probabilityPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted tabular-nums">{probabilityPct}% probability</span>
            <span className="text-foreground-soft font-medium tabular-nums">
              {fmtMoneyCompact(stage.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-2 space-y-2 overflow-y-auto flex-1">
        {stage.deals.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/80 px-3 py-6 text-center text-[11px] text-muted">
            No deals
          </div>
        ) : (
          stage.deals.map(deal => <DealCardView key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}

const TIER_TONE: Record<DealTier, BadgeTone> = {
  AA: "info",
  A: "success",
  B: "warning",
  C: "neutral",
};

const FORMAT_DOT: Record<DealFormat, string> = {
  Liquid: "bg-info",
  Capsule: "bg-primary",
  Powder: "bg-warning",
};

function DealCardView({ deal }: { deal: DealCard }) {
  return (
    <a
      href={deal.hubspotUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg bg-card border border-border px-3 py-2.5 shadow-[var(--shadow-card)] hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-[13px] font-medium text-foreground leading-snug line-clamp-2"
            title={deal.name}
          >
            {deal.name}
          </div>
          {deal.companyName && deal.companyName !== deal.name && (
            <div className="mt-0.5 text-[11px] text-muted truncate" title={deal.companyName}>
              {deal.companyName}
            </div>
          )}
        </div>
        {deal.owner && <OwnerAvatar name={deal.owner.name} initials={deal.owner.initials} />}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground tabular-nums text-[14px]">
          {fmtMoneyCompact(deal.amount)}
        </span>
        <span className="text-[11px] text-muted tabular-nums">
          {formatCloseDate(deal.closeDate, deal.monthExpected)}
        </span>
      </div>

      {(deal.tier || deal.format || deal.productCategory) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {deal.tier && (
            <Badge tone={TIER_TONE[deal.tier]} className="px-1.5 py-0 text-[10px]">
              Tier {deal.tier}
            </Badge>
          )}
          {deal.format && (
            <span className="inline-flex items-center gap-1 text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${FORMAT_DOT[deal.format]}`} />
              {deal.format}
            </span>
          )}
          {!deal.format && deal.productCategory && (
            <span className="inline-flex items-center text-[10px] text-foreground-soft bg-surface border border-border rounded-md px-1.5 py-0.5">
              {deal.productCategory}
            </span>
          )}
        </div>
      )}
    </a>
  );
}

function OwnerAvatar({ name, initials }: { name: string; initials: string }) {
  return (
    <div
      title={name}
      className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-semibold tabular-nums"
    >
      {initials.slice(0, 2)}
    </div>
  );
}

/** Compact money — same look as the original local helper, kept inline so the
 *  kanban renders consistent compact figures (e.g. $145k, $1.45M) regardless of
 *  whether `formatCurrency`'s Intl-compact output drifts. */
function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatCloseDate(iso: string | null, monthExpected: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }
  if (monthExpected) return monthExpected.slice(0, 3);
  return "—";
}
