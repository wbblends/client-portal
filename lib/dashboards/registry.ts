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
  | "Board"
  | "Sales"
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
    | "Kanban"
    | "DollarSign";
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
    id: "board-summary",
    slug: "board-summary",
    name: "Board Summary",
    category: "Board",
    description: "The monthly board pack — same shape every month.",
    iconName: "Briefcase",
  },
  {
    id: "orders-portal",
    slug: "orders-portal",
    name: "Orders",
    category: "Sales",
    description:
      "Booked POs by customer for the year — editable spreadsheet seeded from the 2026 POs workbook, swappable for an Acumatica feed.",
    iconName: "DollarSign",
  },
  {
    id: "sales-pipeline",
    slug: "sales-pipeline",
    name: "New Logo Pipeline",
    category: "Sales",
    description: "Kanban view of open deals in the HubSpot New Logo Pipeline.",
    iconName: "Kanban",
  },
  {
    id: "account-expansion",
    slug: "account-expansion",
    name: "Wallet Share Pipeline",
    category: "Sales",
    description: "Kanban view of open deals in the HubSpot Wallet Share Pipeline.",
    iconName: "TrendingUp",
  },
  {
    id: "pipeline-analytics",
    slug: "pipeline-analytics",
    name: "Pipeline Analytics",
    category: "Sales",
    description: "Top-line totals and per-rep breakdown across both HubSpot pipelines.",
    iconName: "PieChart",
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

/**
 * Filters the registry to dashboards the user can see. Super admins bypass
 * the per-user whitelist and see every dashboard automatically — new
 * dashboards added to the registry appear for them with no DB change. Every
 * other role is gated by their explicit `allowedIds` list.
 */
export function getDashboardsForUser(
  allowedIds: readonly string[],
  role?: "super_admin" | "admin" | "internal" | "customer",
): Dashboard[] {
  if (role === "super_admin") return [...DASHBOARDS];
  const allow = new Set(allowedIds);
  return DASHBOARDS.filter(d => allow.has(d.id));
}

export function userCanSeeDashboard(
  allowedIds: readonly string[],
  slug: string,
  role?: "super_admin" | "admin" | "internal" | "customer",
): boolean {
  const d = getDashboard(slug);
  if (!d) return false;
  if (role === "super_admin") return true;
  return allowedIds.includes(d.id);
}
