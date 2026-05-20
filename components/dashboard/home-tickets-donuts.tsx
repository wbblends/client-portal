"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic-import wrapper around the home tickets donut charts. Recharts is
 * heavy; keeping it behind a dynamic import keeps it out of the home page's
 * initial JS bundle — the donuts load client-side after first paint. See
 * `orders-backlog-charts.tsx` for the same pattern.
 */
const DonutsSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div className="h-[220px] w-full rounded-lg bg-accent/30" />
    <div className="h-[220px] w-full rounded-lg bg-accent/30" />
  </div>
);

export const HomeTicketsDonuts = dynamic(
  () => import("./home-tickets-donuts-impl").then(m => m.HomeTicketsDonuts),
  { ssr: false, loading: DonutsSkeleton },
);
