"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic-import wrapper around the marketing-dashboard pipeline charts. See
 * `yoy-chart.tsx` for the rationale — Recharts is heavy and we want it out
 * of the initial bundle for every page that doesn't render charts.
 */
const ChartSkeleton = () => (
  <div className="h-[260px] w-full rounded-lg bg-accent/30" />
);

export const CumulativePipelineChart = dynamic(
  () => import("./marketing-pipeline-chart-impl").then(m => m.CumulativePipelineChart),
  { ssr: false, loading: ChartSkeleton },
);

export const PipelineFlowChart = dynamic(
  () => import("./marketing-pipeline-chart-impl").then(m => m.PipelineFlowChart),
  { ssr: false, loading: ChartSkeleton },
);
