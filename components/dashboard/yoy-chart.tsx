"use client";

import dynamic from "next/dynamic";

/**
 * Dynamic-import wrapper around the actual Recharts-backed chart.
 *
 * Recharts is ~90KB gzipped and the customer overview is the only page that
 * uses it. By splitting the chart into its own chunk via `next/dynamic` we
 * keep Recharts out of the initial JS bundle for every other page (login,
 * documents, invoices, contacts, admin) — the rest of the app paints first
 * and the chart fetches on demand. The skeleton matches the chart's final
 * height so layout doesn't jump when the chunk arrives.
 */
const ChartSkeleton = () => (
  <div className="h-[280px] w-full rounded-lg bg-accent/30" />
);

export const SalesByDurationChart = dynamic(
  () => import("./yoy-chart-impl").then(m => m.SalesByDurationChart),
  { ssr: false, loading: ChartSkeleton },
);

export type { YoyPoint } from "./yoy-chart-impl";
