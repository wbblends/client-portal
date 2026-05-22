import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  delta,
  hint,
  preferDirection = "up",
  tone = "default",
  emphasizeLabel = false,
}: {
  label: string;
  value: string;
  /** Percent change vs prior period. Pass null to omit. */
  delta?: number | null;
  hint?: string;
  /** "up" means up is good (green); "down" means down is good. */
  preferDirection?: "up" | "down";
  /** Visual tone. "warning" tints the card yellow to match forecast styling. */
  tone?: "default" | "warning";
  /** Render the label a touch larger and semibold — used for the orders
   *  actuals/forecast tiles so the month name reads more prominently. */
  emphasizeLabel?: boolean;
}) {
  let deltaUi: React.ReactNode = null;
  if (delta != null && Number.isFinite(delta)) {
    const isUp = delta > 0.05;
    const isDown = delta < -0.05;
    const goodUp = preferDirection === "up";
    const positive = (isUp && goodUp) || (isDown && !goodUp);
    const negative = (isDown && goodUp) || (isUp && !goodUp);
    const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
    const tone = positive
      ? "text-success bg-success-soft"
      : negative
        ? "text-danger bg-danger-soft"
        : "text-muted bg-accent";
    const sign = delta > 0 ? "+" : "";
    deltaUi = (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
          tone,
        )}
      >
        <Icon className="h-3 w-3" />
        {sign}
        {delta.toFixed(1)}%
      </span>
    );
  }

  const isWarning = tone === "warning";
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 shadow-[var(--shadow-card)]",
        isWarning
          ? "border-warning-soft bg-warning-soft/40"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div
          className={cn(
            emphasizeLabel ? "text-sm font-semibold" : "text-[13px] font-medium",
            isWarning ? "text-warning" : "text-muted",
          )}
        >
          {label}
        </div>
        {deltaUi}
      </div>
      <div className="mt-1.5 font-display text-[28px] tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "mt-0.5 text-xs",
            isWarning ? "text-warning/80" : "text-muted",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
