"use client";

import dynamic from "next/dynamic";

const ChartSkeleton = () => (
  <div className="h-[280px] w-full rounded-lg bg-accent/30" />
);

export const MonthlyPosReceivedChart = dynamic(
  () =>
    import("./orders-received-chart-impl").then(m => m.MonthlyPosReceivedChart),
  { ssr: false, loading: ChartSkeleton },
);
