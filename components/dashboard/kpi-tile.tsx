import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  delta,
  hint,
  preferDirection = "up",
}: {
  label: string;
  value: string;
  /** Percent change vs prior period. Pass null to omit. */
  delta?: number | null;
  hint?: string;
  /** "up" means up is good (green); "down" means down is good. */
  preferDirection?: "up" | "down";
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
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-semibold",
          tone,
        )}
        aria-label={`${positive ? "Up" : negative ? "Down" : "Flat"} ${Math.abs(delta).toFixed(1)} percent versus prior period`}
      >
        <Icon className="h-4 w-4" aria-hidden />
        {sign}
        {delta.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-base font-semibold text-foreground-soft">{label}</div>
        {deltaUi}
      </div>
      <div className="mt-2 text-4xl font-bold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1 text-sm text-muted">{hint}</div>}
    </div>
  );
}
