import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getPipelineKanban,
  type KanbanData,
  type PipelineKanban,
} from "@/lib/marketing/hubspot";
import { PipelineBoard } from "./pipeline-board";

export async function SalesPipelineDashboard() {
  const data = await getPipelineKanban();
  const pipeline = data.pipelines.find(p => p.key === "sales");
  return (
    <SinglePipelinePage
      kicker="Sales"
      title="Sales Pipeline"
      description="Open deals in the Sales Pipeline, grouped by stage. Click any card to see the most recent notes from HubSpot."
      pipeline={pipeline}
      source={data.source}
    />
  );
}

export async function AccountExpansionDashboard() {
  const data = await getPipelineKanban();
  const pipeline = data.pipelines.find(p => p.key === "expansion");
  return (
    <SinglePipelinePage
      kicker="Sales"
      title="Account Expansion"
      description="Open deals in the Account Expansion pipeline, grouped by stage. Click any card to see the most recent notes from HubSpot."
      pipeline={pipeline}
      source={data.source}
    />
  );
}

export async function PipelineAnalyticsDashboard() {
  const data = await getPipelineKanban();
  const summary = computeOverallSummary(data);

  return (
    <div className="page-container page-pad-x page-pad-y space-y-5 sm:space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">Sales</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            Pipeline Analytics
          </h1>
          <p className="mt-1 max-w-[640px] text-sm text-muted">
            Top-line totals across both HubSpot pipelines and a per-rep breakdown of open deals.
          </p>
        </div>
        {data.source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      <SummaryStrip summary={summary} />
      <RepSummary data={data} />
    </div>
  );
}

function SinglePipelinePage({
  kicker,
  title,
  description,
  pipeline,
  source,
}: {
  kicker: string;
  title: string;
  description: string;
  pipeline: PipelineKanban | undefined;
  source: "live" | "placeholder";
}) {
  return (
    <div className="page-container page-pad-x page-pad-y flex flex-col h-dvh gap-5 sm:gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted">{kicker}</p>
          <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1 max-w-[640px] text-sm text-muted">{description}</p>
        </div>
        {source === "placeholder" && (
          <Badge tone="warning">Placeholder data — set HUBSPOT_PRIVATE_APP_TOKEN</Badge>
        )}
      </div>

      {pipeline ? (
        <PipelineBoard pipeline={pipeline} fillHeight />
      ) : (
        <Card className="px-5 py-8 text-sm text-muted">No data for this pipeline.</Card>
      )}
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
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}mm`;
  }
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

