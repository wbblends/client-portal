"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dynamic-import wrapper around the Recharts-backed Customer Feedback view.
 * Keeps Recharts off the route's first-load JS — same `*-impl.tsx` pattern
 * the Tickets analytics page uses.
 */
function ResultsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="px-5 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-[320px] w-full" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-[260px] w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export const SurveyResults = dynamic(
  () => import("./survey-results-impl").then(m => m.SurveyResults),
  { ssr: false, loading: ResultsSkeleton },
);
