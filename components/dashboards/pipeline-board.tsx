"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type {
  DealCard,
  DealFormat,
  DealTier,
  PipelineKanban,
  StageColumn,
} from "@/lib/marketing/hubspot";
import { DealCardView } from "./deal-card";

const DRAG_MIME = "application/x-wb-deal";

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
  // Local pipeline so drag-and-drop updates render optimistically without
  // waiting for a server round trip / page revalidation.
  const [localPipeline, setLocalPipeline] = useState<PipelineKanban>(pipeline);
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // If the server prop changes (e.g. on a fresh render after revalidation),
  // reset the local state to match.
  useEffect(() => {
    setLocalPipeline(pipeline);
  }, [pipeline]);

  const repOptions = useMemo(() => collectRepOptions(localPipeline), [localPipeline]);
  const tierOptions = useMemo(() => collectTierOptions(localPipeline), [localPipeline]);
  const formatOptions = useMemo(() => collectFormatOptions(localPipeline), [localPipeline]);

  const filtered = useMemo(
    () => filterPipeline(localPipeline, repId, tier, format),
    [localPipeline, repId, tier, format],
  );

  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const filtersActive = repId !== "__all__" || tier !== "__all__" || format !== "__all__";
  const dotColor = pipeline.key === "sales" ? "bg-primary" : "bg-info";

  const moveDeal = useCallback(
    async (dealId: string, fromStageId: string, toStageId: string) => {
      if (fromStageId === toStageId) return;
      const snapshot = localPipeline;
      // Optimistically move the card. Weighted value will be recomputed below
      // using the destination stage's probability so the column totals reflect
      // the projected change immediately.
      const toStage = snapshot.stages.find(s => s.id === toStageId);
      const newProbability = toStage?.probability ?? 0;

      let movedDeal: DealCard | null = null;
      const stages = snapshot.stages.map(stage => {
        if (stage.id === fromStageId) {
          const remaining = stage.deals.filter(d => {
            if (d.id !== dealId) return true;
            movedDeal = d;
            return false;
          });
          return {
            ...stage,
            deals: remaining,
            dealCount: remaining.length,
            totalAmount: remaining.reduce((s, d) => s + d.amount, 0),
          };
        }
        return stage;
      });
      if (!movedDeal) return;
      // TS narrows movedDeal back to never inside the map closure; cast once.
      const moved = movedDeal as DealCard;
      const updatedMoved: DealCard = {
        ...moved,
        weighted: moved.amount * newProbability,
      };
      const nextStages = stages.map(stage => {
        if (stage.id === toStageId) {
          const deals = [updatedMoved, ...stage.deals];
          deals.sort((a, b) => b.amount - a.amount);
          return {
            ...stage,
            deals,
            dealCount: deals.length,
            totalAmount: deals.reduce((s, d) => s + d.amount, 0),
          };
        }
        return stage;
      });
      setLocalPipeline({ ...snapshot, stages: nextStages });
      setMoveError(null);

      try {
        const res = await fetch(`/api/marketing/deals/${dealId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: toStageId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Failed to move deal (${res.status})`);
        }
        const data = (await res.json()) as {
          weighted: number;
          stageId: string | null;
        };
        // Sync the moved card's weighted value to whatever HubSpot computed.
        if (Number.isFinite(data.weighted)) {
          setLocalPipeline(prev => ({
            ...prev,
            stages: prev.stages.map(stage => {
              if (stage.id !== (data.stageId ?? toStageId)) return stage;
              return {
                ...stage,
                deals: stage.deals.map(d =>
                  d.id === dealId ? { ...d, weighted: data.weighted } : d,
                ),
              };
            }),
          }));
        }
      } catch (err) {
        setLocalPipeline(snapshot);
        setMoveError(err instanceof Error ? err.message : "Failed to move deal");
      }
    },
    [localPipeline],
  );

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
          {filtersActive && (
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
        <span aria-hidden className={`hidden sm:inline-block h-2 w-2 rounded-full ${dotColor}`} />
      </div>

      <KpiStrip totals={totals} filtered={filtersActive} />

      {moveError && (
        <div
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger"
        >
          {moveError}
        </div>
      )}

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
              draggingDealId={draggingDealId}
              dragOverStageId={dragOverStageId}
              onDragStartDeal={(dealId) => setDraggingDealId(dealId)}
              onDragEndDeal={() => {
                setDraggingDealId(null);
                setDragOverStageId(null);
              }}
              onDragOverStage={(stageId) => setDragOverStageId(stageId)}
              onDragLeaveStage={(stageId) => {
                setDragOverStageId(prev => (prev === stageId ? null : prev));
              }}
              onDropOnStage={(dealId, fromStageId, toStageId) => {
                setDraggingDealId(null);
                setDragOverStageId(null);
                void moveDeal(dealId, fromStageId, toStageId);
              }}
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
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

type Totals = { unweighted: number; weighted: number; dealCount: number };

function computeTotals(pipeline: PipelineKanban): Totals {
  let unweighted = 0;
  let weighted = 0;
  let dealCount = 0;
  for (const stage of pipeline.stages) {
    // Closed-won / closed-lost stages render on the board with an overlay,
    // but their value must not count toward open pipeline totals.
    if (stage.isClosed) continue;
    for (const deal of stage.deals) {
      unweighted += deal.amount;
      weighted += deal.weighted;
      dealCount += 1;
    }
  }
  return { unweighted, weighted, dealCount };
}

function KpiStrip({ totals, filtered }: { totals: Totals; filtered: boolean }) {
  const hint = filtered ? "Filtered subset" : null;
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        <KpiCell label="Pipeline Value" primary={fmtMoneyCompact(totals.unweighted)} hint={hint ?? "Sum of open deal amounts"} />
        <KpiCell label="Weighted Value" primary={fmtMoneyCompact(totals.weighted)} hint={hint ?? "Probability-adjusted, from HubSpot"} />
        <KpiCell label="Open Deals" primary={totals.dealCount.toLocaleString()} hint={hint ?? "Count of open deals"} />
      </div>
    </Card>
  );
}

function KpiCell({ label, primary, hint }: { label: string; primary: string; hint: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 font-display text-[26px] tabular-nums tracking-tight text-foreground">
        {primary}
      </div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
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
  draggingDealId,
  dragOverStageId,
  onDragStartDeal,
  onDragEndDeal,
  onDragOverStage,
  onDragLeaveStage,
  onDropOnStage,
}: {
  stage: StageColumn;
  pipelineKey: string;
  fillHeight?: boolean;
  draggingDealId: string | null;
  dragOverStageId: string | null;
  onDragStartDeal: (dealId: string) => void;
  onDragEndDeal: () => void;
  onDragOverStage: (stageId: string) => void;
  onDragLeaveStage: (stageId: string) => void;
  onDropOnStage: (dealId: string, fromStageId: string, toStageId: string) => void;
}) {
  const probabilityPct = Math.round(stage.probability * 100);
  // Closed stages get a colored wash — light green for won, gray for lost —
  // so they read as "settled" and visually separate from open pipeline.
  const closedTone: "won" | "lost" | null =
    stage.outcome === "won" ? "won" : stage.outcome === "lost" ? "lost" : null;
  const barColor =
    closedTone === "won"
      ? "bg-success"
      : closedTone === "lost"
        ? "bg-muted"
        : pipelineKey === "sales"
          ? "bg-primary"
          : "bg-info";
  const isDragTarget = draggingDealId !== null && dragOverStageId === stage.id;
  const isAnyDragging = draggingDealId !== null;
  const columnTone = isDragTarget
    ? "bg-primary/5 border-primary/50 ring-2 ring-primary/20"
    : closedTone === "won"
      ? "bg-success-soft/60 border-success/30"
      : closedTone === "lost"
        ? "bg-muted/10 border-border"
        : "bg-surface/60 border-border";

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!isAnyDragging) return;
    // Must preventDefault to allow drop.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stage.id) onDragOverStage(stage.id);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear if we left the column entirely (dragleave fires on inner
    // children too). Compare currentTarget against the related target.
    const next = e.relatedTarget as Node | null;
    if (next && (e.currentTarget as Node).contains(next)) return;
    onDragLeaveStage(stage.id);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const payload = e.dataTransfer?.getData(DRAG_MIME);
    if (!payload) return;
    const [dealId, fromStageId] = payload.split("|");
    if (!dealId || !fromStageId) return;
    onDropOnStage(dealId, fromStageId, stage.id);
  }

  return (
    <div
      className={`w-[320px] shrink-0 rounded-xl border flex flex-col transition-colors ${columnTone} ${
        fillHeight ? "h-full min-h-[480px]" : "max-h-[720px]"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-dropeffect={isAnyDragging ? "move" : undefined}
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
          <div
            className={`rounded-md border border-dashed px-3 py-6 text-center text-[11px] ${
              isDragTarget
                ? "border-primary/50 text-primary"
                : "border-border/80 text-muted"
            }`}
          >
            {isDragTarget ? "Drop to move here" : "No deals"}
          </div>
        ) : (
          stage.deals.map(deal => (
            <DealCardView
              key={deal.id}
              deal={deal}
              overlay={closedTone ?? undefined}
              draggable
              isDragging={draggingDealId === deal.id}
              onDragStart={(e) => {
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(DRAG_MIME, `${deal.id}|${stage.id}`);
                }
                onDragStartDeal(deal.id);
              }}
              onDragEnd={() => onDragEndDeal()}
            />
          ))
        )}
      </div>
    </div>
  );
}

function fmtMoneyCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${Number.isInteger(m) ? m : m.toFixed(1)}mm`;
  }
  if (n >= 10_000) return `$${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
