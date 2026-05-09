/**
 * Single source of truth for every dashboard the portal can render.
 *
 * To add a dashboard:
 *   1. Add an entry below with a unique `id` (used in users.json permissions
 *      lists) and a unique URL `slug`.
 *   2. Build a server component for it under `components/dashboards/`.
 *   3. Wire the component into `app/(portal)/dashboards/[slug]/page.tsx`'s
 *      `RENDERERS` map.
 *
 * Categories drive the grouping in the sidebar. Add a new category by using
 * a new value here — the sidebar reads it dynamically.
 */
export type DashboardCategory =
  | "Executive"
  | "Sales"
  | "Department"
  | "Board"
  | "Customer Success"
  | "Marketing";

export type Dashboard = {
  id: string;
  slug: string;
  name: string;
  category: DashboardCategory;
  description: string;
  /** Lucide icon name. Resolved client-side in the sidebar. */
  iconName:
    | "LayoutDashboard"
    | "TrendingUp"
    | "LineChart"
    | "PieChart"
    | "Users"
    | "Briefcase"
    | "Factory"
    | "Truck"
    | "Kanban";
};

export const DASHBOARDS: readonly Dashboard[] = [
  // Cross-customer dashboards. Per-customer dashboards (the customer
  // overview) live under /c/[customerId]/* and are not in this registry —
  // they're driven by the customers registry instead.
  //
  // Examples — flesh out as you build them. Until a renderer is wired in
  // app/(portal)/dashboards/[slug]/page.tsx, the page falls back to a
  // "coming soon" placeholder.
  {
    id: "exec-sales",
    slug: "exec-sales",
    name: "Sales Executive",
    category: "Executive",
    description: "Cross-customer sales performance for the leadership team.",
    iconName: "TrendingUp",
  },
  {
    id: "exec-operations",
    slug: "exec-operations",
    name: "Operations Executive",
    category: "Executive",
    description: "Throughput, on-time rate, and quality holds across the plant.",
    iconName: "Factory",
  },
  {
    id: "board-summary",
    slug: "board-summary",
    name: "Board Summary",
    category: "Board",
    description: "The monthly board pack — same shape every month.",
    iconName: "Briefcase",
  },
  {
    id: "account-health",
    slug: "account-health",
    name: "Account Health",
    category: "Customer Success",
    description: "Per-account stop-light view for the customer success team.",
    iconName: "PieChart",
  },
  {
    id: "orders-portal",
    slug: "orders-portal",
    name: "Orders Portal",
    category: "Sales",
    description:
      "Booked POs by customer for the year — editable spreadsheet seeded from the 2026 POs workbook, swappable for an Acumatica feed.",
    iconName: "Truck",
  },
  {
    id: "pipeline-kanban",
    slug: "pipeline",
    name: "Pipeline",
    category: "Sales",
    description:
      "Kanban view of open deals across both HubSpot pipelines — Sales Pipeline and Account Expansion.",
    iconName: "Kanban",
  },
  {
    id: "marketing-overview",
    slug: "marketing-overview",
    name: "Marketing Overview",
    category: "Marketing",
    description:
      "HubSpot pipeline value (weighted + unweighted), ad spend, inbound leads, and rep handoff rate.",
    iconName: "LineChart",
  },
] as const;

export function listDashboards(): readonly Dashboard[] {
  return DASHBOARDS;
}

export function getDashboard(slug: string): Dashboard | null {
  return DASHBOARDS.find(d => d.slug === slug) ?? null;
}

export function getDashboardById(id: string): Dashboard | null {
  return DASHBOARDS.find(d => d.id === id) ?? null;
}

export function getDashboardsForUser(allowedIds: readonly string[]): Dashboard[] {
  const allow = new Set(allowedIds);
  return DASHBOARDS.filter(d => allow.has(d.id));
}

export function userCanSeeDashboard(
  allowedIds: readonly string[],
  slug: string,
): boolean {
  const d = getDashboard(slug);
  return !!d && allowedIds.includes(d.id);
}
