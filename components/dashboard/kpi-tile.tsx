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

  return (
    <div className="glass-tinted rounded-2xl px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        {deltaUi}
      </div>
      <div className="mt-1.5 text-[28px] font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
