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
          <div key={ind.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="text-base font-semibold text-foreground">{ind.label}</div>
              {ind.note && <div className="mt-1 text-sm text-muted">{ind.note}</div>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-base font-bold tabular-nums text-foreground">{ind.value}</div>
              <div className={cn("inline-flex items-center gap-1 text-sm font-semibold", tone)}>
                <Icon className="h-4 w-4" aria-hidden />
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
