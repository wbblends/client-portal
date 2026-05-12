"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import type {
  DealCard,
  DealFormat,
  DealTier,
  PipelineKanban,
  StageColumn,
} from "@/lib/marketing/hubspot";
import { DealCardView } from "./deal-card";

const UNASSIGNED_OWNER_ID = "__unassigned__";
const TIER_ORDER: DealTier[] = ["AA", "A", "B", "C"];
const FORMAT_ORDER: DealFormat[] = ["Liquid", "Capsule", "Powder"];

/**
 * Client-side wrapper around a single pipeline's kanban view. Adds rep, tier,
 * and format filters that narrow the deals shown in each stage without
 * losing the stage scaffolding. Stage totals and counts recompute from the
 * visible subset so the header reflects what's on screen.
 */
export function PipelineBoard({
  pipeline,
  fillHeight,
}: {
  pipeline: PipelineKanban;
  fillHeight?: boolean;
}) {
  const [repId, setRepId] = useState<string>("__all__");
  const [tier, setTier] = useState<string>("__all__");
  const [format, setFormat] = useState<string>("__all__");

  const repOptions = useMemo(() => collectRepOptions(pipeline), [pipeline]);
  const tierOptions = useMemo(() => collectTierOptions(pipeline), [pipeline]);
  const formatOptions = useMemo(() => collectFormatOptions(pipeline), [pipeline]);

  const filtered = useMemo(
    () => filterPipeline(pipeline, repId, tier, format),
    [pipeline, repId, tier, format],
  );

  const total = filtered.stages.reduce((s, st) => s + st.totalAmount, 0);
  const dealCount = filtered.stages.reduce((s, st) => s + st.dealCount, 0);
  const dotColor = pipeline.key === "sales" ? "bg-primary" : "bg-info";

  return (
    <section
      className={
        fillHeight ? "flex flex-col flex-1 min-h-0 gap-3" : "space-y-3"
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Filter by rep">
            <Select
              value={repId}
              onChange={e => setRepId(e.target.value)}
              className="min-w-[180px]"
              aria-label="Filter by rep"
            >
              <option value="__all__">All reps</option>
              {repOptions.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Filter by tier">
            <Select
              value={tier}
              onChange={e => setTier(e.target.value)}
              className="min-w-[140px]"
              aria-label="Filter by tier"
            >
              <option value="__all__">All tiers</option>
              {tierOptions.map(t => (
                <option key={t} value={t}>
                  {t === "__none__" ? "No tier" : `Tier ${t}`}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Filter by format">
            <Select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="min-w-[150px]"
              aria-label="Filter by format"
            >
              <option value="__all__">All formats</option>
              {formatOptions.map(f => (
                <option key={f} value={f}>
                  {f === "__none__" ? "No format" : f}
                </option>
              ))}
            </Select>
          </FilterField>
          {(repId !== "__all__" || tier !== "__all__" || format !== "__all__") && (
            <button
              type="button"
              onClick={() => {
                setRepId("__all__");
                setTier("__all__");
                setFormat("__all__");
              }}
              className="h-10 px-2.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-5 text-xs text-muted">
          <span>
            <span className="text-foreground font-semibold tabular-nums">{dealCount}</span>{" "}
            <span className="text-muted">open deals</span>
          </span>
          <span className="hidden sm:inline h-3 w-px bg-border" />
          <span>
            <span className="text-foreground font-semibold tabular-nums">
              {fmtMoneyCompact(total)}
            </span>{" "}
            <span className="text-muted">unweighted</span>
          </span>
          <span aria-hidden className={`hidden sm:inline-block h-2 w-2 rounded-full ${dotColor}`} />
        </div>
      </div>

      <div
        className={`-mx-[clamp(1rem,3vw,2.5rem)] page-pad-x overflow-x-auto pb-3 ${
          fillHeight ? "flex-1 min-h-0" : ""
        }`}
      >
        <div className={`flex gap-4 min-w-max ${fillHeight ? "h-full" : ""}`}>
          {filtered.stages.map(stage => (
            <StageColumnView
              key={stage.id}
              stage={stage}
              pipelineKey={pipeline.key}
              fillHeight={fillHeight}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

type RepOption = { id: string; name: string };

function collectRepOptions(pipeline: PipelineKanban): RepOption[] {
  const seen = new Map<string, RepOption>();
  let hasUnassigned = false;
  for (const stage of pipeline.stages) {
    for (const deal of stage.deals) {
      if (deal.owner) {
        if (!seen.has(deal.owner.id)) {
          seen.set(deal.owner.id, { id: deal.owner.id, name: deal.owner.name });
        }
      } else {
        hasUnassigned = true;
      }
    }
  }
  const reps = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (hasUnassigned) reps.push({ id: UNASSIGNED_OWNER_ID, name: "Unassigned" });
  return reps;
}

function collectTierOptions(pipeline: PipelineKanban): string[] {
  const present = new Set<string>();
  let hasNone = false;
  for (const stage of pipeline.stages) {
    for (const deal of stage.deals) {
      if (deal.tier) present.add(deal.tier);
      else hasNone = true;
    }
  }
  const ordered = TIER_ORDER.filter(t => present.has(t)) as string[];
  if (hasNone) ordered.push("__none__");
  return ordered;
}

function collectFormatOptions(pipeline: PipelineKanban): string[] {
  const present = new Set<string>();
  let hasNone = false;
  for (const stage of pipeline.stages) {
    for (const deal of stage.deals) {
      if (deal.format) present.add(deal.format);
      else hasNone = true;
    }
  }
  const ordered = FORMAT_ORDER.filter(f => present.has(f)) as string[];
  if (hasNone) ordered.push("__none__");
  return ordered;
}

function filterPipeline(
  pipeline: PipelineKanban,
  repId: string,
  tier: string,
  format: string,
): PipelineKanban {
  const repAll = repId === "__all__";
  const tierAll = tier === "__all__";
  const formatAll = format === "__all__";
  if (repAll && tierAll && formatAll) return pipeline;

  const matches = (deal: DealCard): boolean => {
    if (!repAll) {
      const ownerId = deal.owner?.id ?? UNASSIGNED_OWNER_ID;
      if (ownerId !== repId) return false;
    }
    if (!tierAll) {
      const dealTier: string = deal.tier ?? "__none__";
      if (dealTier !== tier) return false;
    }
    if (!formatAll) {
      const dealFormat: string = deal.format ?? "__none__";
      if (dealFormat !== format) return false;
    }
    return true;
  };

  return {
    ...pipeline,
    stages: pipeline.stages.map(stage => {
      const deals = stage.deals.filter(matches);
      const totalAmount = deals.reduce((s, d) => s + d.amount, 0);
      return {
        ...stage,
        deals,
        dealCount: deals.length,
        totalAmount,
      };
    }),
  };
}

function StageColumnView({
  stage,
  pipelineKey,
  fillHeight,
}: {
  stage: StageColumn;
  pipelineKey: string;
  fillHeight?: boolean;
}) {
  const probabilityPct = Math.round(stage.probability * 100);
  const barColor = pipelineKey === "sales" ? "bg-primary" : "bg-info";
  return (
    <div
      className={`w-[300px] shrink-0 rounded-xl bg-surface/60 border border-border flex flex-col ${
        fillHeight ? "h-full min-h-[480px]" : "max-h-[720px]"
      }`}
    >
      <div className="px-3.5 pt-3.5 pb-3 border-b border-border/70">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-foreground truncate" title={stage.label}>
            {stage.label}
          </div>
          <span className="shrink-0 text-[11px] font-medium text-muted bg-card border border-border rounded-md px-1.5 py-0.5 tabular-nums">
            {stage.dealCount}
          </span>
        </div>

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

function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
