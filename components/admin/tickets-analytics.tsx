"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dynamic-import wrapper around the Recharts-backed analytics view.
 *
 * Recharts is ~90KB+ gzipped and `/admin/tickets/analytics` is the only route
 * that renders this view. Splitting it into its own chunk via `next/dynamic`
 * keeps Recharts off the analytics route's first-load JS — the page shell and
 * skeleton paint immediately and the chart bundle streams in after. Matches
 * the `*-impl.tsx` pattern every other chart in the app already uses.
 */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="px-5 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </Card>
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, s) => (
        <section key={s} className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-4 h-[260px] w-full" />
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const TicketsAnalytics = dynamic(
  () => import("./tickets-analytics-impl").then(m => m.TicketsAnalytics),
  { ssr: false, loading: AnalyticsSkeleton },
);
