"use client";

import dynamic from "next/dynamic";

const ChartSkeleton = () => (
  <div className="h-[260px] w-full rounded-lg bg-accent/30" />
);

export const BacklogSnapshotsChart = dynamic(
  () => import("./orders-backlog-charts-impl").then(m => m.BacklogSnapshotsChart),
  { ssr: false, loading: ChartSkeleton },
);

export const BacklogWeeklyChart = dynamic(
  () => import("./orders-backlog-charts-impl").then(m => m.BacklogWeeklyChart),
  { ssr: false, loading: ChartSkeleton },
);
