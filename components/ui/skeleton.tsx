import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer block that fills any container. Animation lives in `globals.css`
 * under `.skeleton`. Use width/height utility classes to size it.
 *
 *   <Skeleton className="h-6 w-32" />
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />;
}

/** Skeleton sized like a KPI tile, used by every customer overview loading state. */
export function KpiTileSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

/** Card-shaped skeleton: header pair + N body rows. */
export function CardSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="px-5 pt-5 pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </div>
      <div className="px-5 pb-5 space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Eyebrow + h1 + description block sized to match the real page header. */
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-10 w-44 shrink-0" />}
    </div>
  );
}
