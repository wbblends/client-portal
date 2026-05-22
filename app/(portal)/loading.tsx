import {
  Skeleton,
  KpiTileSkeleton,
  CardSkeleton,
  PageHeaderSkeleton,
} from "@/components/ui/skeleton";

/**
 * Generic portal route fallback. Shown instantly on navigation to any
 * `(portal)` route that doesn't ship its own `loading.tsx` — admin pages,
 * account pages, the dashboards index, etc. Routes with a closer, page-shaped
 * `loading.tsx` (the `/c/[customerId]/*` views, `/dashboards/[slug]`) keep
 * using theirs; Next picks the nearest one.
 *
 * Kept deliberately generic: a header + KPI row + a couple of cards covers
 * the shape of most portal pages well enough to avoid a blank flash without
 * pretending to match every layout exactly.
 */
export default function PortalLoading() {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      <PageHeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="px-5 pt-5 pb-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-72 max-w-full" />
        </div>
        <div className="px-5 pb-5">
          <Skeleton className="h-[240px] w-full" />
        </div>
      </div>

      <CardSkeleton rows={5} />
    </div>
  );
}
