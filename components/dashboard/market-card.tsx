import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketIndicator } from "@/lib/data/types";

export function MarketCard({ indicators }: { indicators: MarketIndicator[] }) {
  return (
    <div className="divide-y divide-border">
      {indicators.map(ind => {
        const up = ind.delta > 0.05;
        const down = ind.delta < -0.05;
        const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
        const tone = up ? "text-danger" : down ? "text-success" : "text-muted";
        // Note: in commodity context up movement is bad for buyer cost, hence danger.
        return (
          <div key={ind.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{ind.label}</div>
              {ind.note && <div className="mt-0.5 text-xs text-muted">{ind.note}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold tabular-nums text-foreground">{ind.value}</div>
              <div className={cn("inline-flex items-center gap-0.5 text-xs font-medium", tone)}>
                <Icon className="h-3 w-3" />
                {ind.delta > 0 ? "+" : ""}
                {ind.delta.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
