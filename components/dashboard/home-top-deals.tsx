import { ExternalLink, Flame } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DealCard, StageColumn, PipelineKanban, PipelineKey } from "@/lib/marketing/hubspot";
import { formatCurrency } from "@/lib/utils";

export type ScoredDeal = DealCard & {
  pipelineKey: PipelineKey;
  stageLabel: string;
  stageProbability: number;
  score: number;
  parts: {
    activity: number;
    value: number;
    velocity: number;
    progress: number;
  };
};

/**
 * Score open deals across a kanban pipeline on four signals, normalize each to
 * [0..1] within the pipeline, then blend with equal weights. Used by the
 * homepage to surface the deals most worth a glance — recency of conversation,
 * weighted value, progress through the funnel, and how much progress each deal
 * has earned per day open.
 */
export function scoreDealsForPipeline(pipeline: PipelineKanban): ScoredDeal[] {
  const now = Date.now();
  const dayMs = 86_400_000;

  type Raw = {
    deal: DealCard;
    stage: StageColumn;
    activity: number;
    value: number;
    velocity: number;
    progress: number;
  };

  const raws: Raw[] = [];
  for (const stage of pipeline.stages) {
    if (stage.isClosed) continue;
    for (const deal of stage.deals) {
      const lastNoteMs = deal.lastNoteDate ? Date.parse(deal.lastNoteDate) : NaN;
      const daysSinceLastNote = Number.isFinite(lastNoteMs)
        ? Math.max(0, (now - lastNoteMs) / dayMs)
        : 365;
      const createMs = deal.createDate ? Date.parse(deal.createDate) : NaN;
      const daysOpen = Number.isFinite(createMs)
        ? Math.max(1, (now - createMs) / dayMs)
        : 365;
      raws.push({
        deal,
        stage,
        // 1 at "today", 0.5 at one week ago, 0.25 at two weeks.
        activity: 1 / (1 + daysSinceLastNote / 7),
        value: Math.max(0, deal.weighted || 0),
        velocity: stage.probability / daysOpen,
        progress: stage.probability,
      });
    }
  }

  if (raws.length === 0) return [];

  const maxOf = (sel: (r: Raw) => number) =>
    Math.max(...raws.map(sel), 1e-9);
  const maxActivity = maxOf(r => r.activity);
  const maxValue = maxOf(r => r.value);
  const maxVelocity = maxOf(r => r.velocity);
  const maxProgress = maxOf(r => r.progress);

  return raws
    .map(r => {
      const parts = {
        activity: r.activity / maxActivity,
        value: r.value / maxValue,
        velocity: r.velocity / maxVelocity,
        progress: r.progress / maxProgress,
      };
      const score =
        parts.activity * 0.25 +
        parts.value * 0.25 +
        parts.velocity * 0.25 +
        parts.progress * 0.25;
      return {
        ...r.deal,
        pipelineKey: pipeline.key,
        stageLabel: r.stage.label,
        stageProbability: r.stage.probability,
        score,
        parts,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent"
        aria-label={`${label} ${pct}%`}
      >
        <div
          className="h-full bg-primary"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
}

export function TopDealsCard({
  title,
  deals,
  limit = 4,
}: {
  title: string;
  deals: ScoredDeal[];
  limit?: number;
}) {
  const top = deals.slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {top.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">No open deals.</p>
        ) : (
          top.map((d, i) => (
            <a
              key={d.id}
              href={d.hubspotUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-border bg-surface/30 px-4 py-3.5 transition hover:border-primary/40 hover:bg-surface/60"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {i === 0 && (
                      <Flame
                        className="h-3.5 w-3.5 shrink-0 text-warning"
                        aria-hidden
                      />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">
                      {d.companyName ?? d.name}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {d.companyName ? d.name : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="font-display text-sm tracking-tight text-foreground">
                    {formatCurrency(d.weighted, { compact: true })}
                  </div>
                  <div className="text-[10px] text-muted">weighted</div>
                </div>
              </div>
              <div className="mt-3">
                <Badge tone="neutral" className="font-medium">
                  {d.stageLabel}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                <ScoreBar value={d.parts.activity} label="active" />
                <ScoreBar value={d.parts.value} label="value" />
                <ScoreBar value={d.parts.velocity} label="velocity" />
                <ScoreBar value={d.parts.progress} label="progress" />
              </div>
            </a>
          ))
        )}
        <div className="pt-1 text-right">
          <a
            href={
              deals[0]?.pipelineKey === "expansion"
                ? "/dashboards/account-expansion"
                : "/dashboards/sales-pipeline"
            }
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            View pipeline <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
