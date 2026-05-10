import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type {
  AccountPenetrationRow,
  ThermometerSegment,
} from "@/lib/data/account-penetration";
import type { StageBucket } from "@/lib/hubspot/pipelines";

/**
 * Single account thermometer. Width = expected annual value at account close.
 * Fill is stacked left → right by stage bucket, darkest first (closed-won) so
 * "actually shipping" reads at a glance and lighter wedges show pipeline depth
 * for the rest of the bar. White space at the right = unsold capacity.
 *
 * Pass `children` to attach an SKU breakdown (or any other detail block)
 * inside the same bordered card so they read as one unit.
 */
export function AccountPenetrationThermometer({
  row,
  children,
}: {
  row: AccountPenetrationRow;
  children?: React.ReactNode;
}) {
  const total = row.expectedAnnualValue;
  const pctFilled = total > 0 ? (row.filledValue / total) * 100 : 0;
  const pctInFlight = total > 0 ? (row.inFlightValue / total) * 100 : 0;
  const pctOverall = Math.min(100, pctFilled + pctInFlight);

  // Render order: closed_won (darkest) first, then later stages get lighter.
  // Segments arrive earliest → latest, so reverse for the visual stack.
  const renderOrder: StageBucket[] = ["closed_won", "onboarding", "quoting", "rnd"];
  const orderedSegments = renderOrder
    .map(b => row.segments.find(s => s.bucket === b)!)
    .filter(s => s.value > 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header strip */}
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <div className="min-w-0">
          <h3 className="font-display text-[20px] leading-tight tracking-tight text-foreground truncate">
            {row.companyName}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {row.industry ? `${row.industry} · ` : ""}
            Account closed{" "}
            {row.accountClosedDate ? formatDate(row.accountClosedDate, "short") : "—"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted leading-tight">Expected annual</div>
          <div className="font-display text-[22px] leading-tight tabular-nums text-foreground">
            {formatCurrency(total, { compact: true })}
          </div>
        </div>
      </div>

      {/* Thermometer bar */}
      <div className="px-5 pb-3">
        <div className="relative h-6 w-full rounded-md bg-accent overflow-hidden border border-border">
          {orderedSegments.map(seg => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={seg.bucket}
                className={cn("h-full inline-block align-top", segmentClass(seg.bucket))}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${formatCurrency(seg.value, { compact: true })} (${seg.dealCount} deal${seg.dealCount === 1 ? "" : "s"})`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted tabular-nums">
          <span>
            <span className="text-foreground font-semibold">
              {formatCurrency(row.filledValue, { compact: true })}
            </span>{" "}
            shipping ({pctFilled.toFixed(0)}%)
          </span>
          <span>
            {formatCurrency(row.inFlightValue, { compact: true })} in flight ·{" "}
            {formatCurrency(row.whiteSpaceValue, { compact: true })} white space
          </span>
          <span>{pctOverall.toFixed(0)}% of plan</span>
        </div>
      </div>

      {/* Per-stage breakdown */}
      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
        {row.segments
          .slice()
          .reverse()
          .map(seg => (
            <StageChip key={seg.bucket} segment={seg} />
          ))}
      </div>

      {children}
    </div>
  );
}

function StageChip({ segment }: { segment: ThermometerSegment }) {
  if (segment.value <= 0) return null;
  return (
    <Badge tone={badgeTone(segment.bucket)} className="gap-2">
      <span
        aria-hidden
        className={cn("inline-block h-2 w-2 rounded-sm", segmentClass(segment.bucket))}
      />
      <span className="font-medium">{segment.label}</span>
      <span className="text-foreground-soft tabular-nums">
        {formatCurrency(segment.value, { compact: true })}
      </span>
      <span className="text-muted">
        · {segment.dealCount} deal{segment.dealCount === 1 ? "" : "s"}
      </span>
    </Badge>
  );
}

/**
 * Tailwind classes for each bucket. We use the brand purple at descending
 * opacity so closed-won reads as the darkest and earlier stages fade into the
 * lighter end. The empty track is `bg-accent` (very pale purple).
 */
function segmentClass(bucket: StageBucket): string {
  switch (bucket) {
    case "closed_won": return "bg-primary";
    case "onboarding": return "bg-primary/60";
    case "quoting":    return "bg-primary/35";
    case "rnd":        return "bg-primary/20";
  }
}

function badgeTone(bucket: StageBucket): "success" | "info" | "warning" | "neutral" {
  switch (bucket) {
    case "closed_won": return "success";
    case "onboarding": return "info";
    case "quoting":    return "warning";
    case "rnd":        return "neutral";
  }
}
