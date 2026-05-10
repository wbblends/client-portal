import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Deal } from "@/lib/hubspot/deals";
import type { Pipeline } from "@/lib/hubspot/pipelines";

/**
 * Compact list of expansion-pipeline SKUs for an account. Renders below the
 * thermometer so a sales rep can see exactly which products make up each
 * stage band.
 */
export function AccountExpansionSkus({
  deals,
  pipeline,
}: {
  deals: Deal[];
  pipeline: Pipeline | null;
}) {
  if (deals.length === 0) {
    return (
      <p className="text-xs text-muted px-5 pb-4">
        No expansion-pipeline deals tied to this account yet.
      </p>
    );
  }

  const stageById = new Map(pipeline?.stages.map(s => [s.id, s]) ?? []);

  return (
    <div className="border-t border-border bg-surface/50">
      <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Expansion SKUs
      </div>
      <ul className="divide-y divide-border">
        {deals.map(d => {
          const stage = stageById.get(d.stageId);
          const tone =
            stage?.bucket === "closed_won"
              ? "success"
              : stage?.bucket === "onboarding"
                ? "info"
                : stage?.bucket === "quoting"
                  ? "warning"
                  : "neutral";
          return (
            <li
              key={d.id}
              className="px-5 py-2 flex items-center justify-between gap-3 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{d.name}</div>
                <div className="text-[11px] text-muted">
                  {d.sku ? <span className="font-mono mr-2">{d.sku}</span> : null}
                  {d.closedDate ? `Closed ${formatDate(d.closedDate, "short")}` : "In progress"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={tone}>{stage?.label ?? "—"}</Badge>
                <span className="font-semibold tabular-nums text-foreground w-[80px] text-right">
                  {formatCurrency(d.expectedAnnualValue, { compact: true })}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
