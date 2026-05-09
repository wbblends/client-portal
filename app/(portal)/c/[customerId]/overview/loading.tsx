import {
  Skeleton,
  KpiTileSkeleton,
  CardSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton";

/**
 * Server-fallback shown while the overview's parallel data fetches resolve
 * (Acumatica orders, profile, on-time rate, onboarding, open orders…).
 * The shape mirrors the real page so layout doesn't shift on hand-off.
 */
export default function OverviewLoading() {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <PageHeaderSkeleton withAction />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="px-5 pt-5 pb-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-72 max-w-full" />
        </div>
        <div className="px-5 pb-5">
          <Skeleton className="h-[260px] w-full" />
        </div>
      </div>

      <CardSkeleton rows={5} />
      <CardSkeleton rows={4} />
      <CardSkeleton rows={6} />
    </div>
  );
}
