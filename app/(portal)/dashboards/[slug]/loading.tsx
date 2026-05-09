import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic dashboard skeleton. Rendered by Next.js while the route's server
 * component (the dashboard renderer) is awaiting data — most useful for the
 * marketing dashboard, where HubSpot calls take 1–3s. The shapes mirror the
 * common dashboard layout: page header → KPI tiles → big card → big card.
 */
export default function DashboardLoading() {
  return (
    <div className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      {/* Top tile row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-24" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Big chart card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>

      {/* Second chart card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
