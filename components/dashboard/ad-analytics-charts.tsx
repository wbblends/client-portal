"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic-import wrapper for the marketing-overview's ad analytics charts.
 * Recharts is heavy; keep it out of the bundle for pages that don't need it.
 */
const ChartSkeleton = ({ height = 260 }: { height?: number }) => (
  <div className="w-full rounded-lg bg-accent/30" style={{ height }} />
);

export const PaidVisitsTrendChart = dynamic(
  () => import("./ad-analytics-charts-impl").then(m => m.PaidVisitsTrendChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> },
);

export const TrafficShareChart = dynamic(
  () => import("./ad-analytics-charts-impl").then(m => m.TrafficShareChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);

export const EngagementCompareChart = dynamic(
  () => import("./ad-analytics-charts-impl").then(m => m.EngagementCompareChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);
