/**
 * Static catalog of portal destinations the AI bot can point users at.
 *
 * The bot's `navigate_portal` tool searches this list by topic keywords and
 * returns the best match. Keep entries terse — the description is what the
 * bot reads when deciding which page fits the user's question.
 *
 * `audience` gates which entries surface for which roles:
 *   - "all":      every signed-in user
 *   - "admin":    only admin / super_admin
 *   - "customer": only customer-role users (lives under /c/[customerId])
 */
export type NavigationAudience = "all" | "admin" | "customer";

export type NavigationTarget = {
  id: string;
  /** Relative URL the bot will hand back. For customer-scoped pages, this
   *  contains `{customerId}` which the tool dispatcher substitutes. */
  url: string;
  title: string;
  /** One-line summary of what's on the page. */
  description: string;
  /** Free-form keywords the bot matches against. Lowercase. */
  keywords: string[];
  audience: NavigationAudience;
};

export const NAVIGATION_TARGETS: NavigationTarget[] = [
  {
    id: "home",
    url: "/home",
    title: "Home",
    description: "Portal home — where the magical search bar lives.",
    keywords: ["home", "landing", "start", "main", "dashboard home"],
    audience: "all",
  },
  {
    id: "account-profile",
    url: "/account/profile",
    title: "Account · Profile",
    description:
      "Update your display name, company, profile photo, and password.",
    keywords: [
      "profile",
      "photo",
      "avatar",
      "picture",
      "display name",
      "company",
      "update password",
      "change password",
      "account",
    ],
    audience: "all",
  },
  {
    id: "account-security",
    url: "/account/security",
    title: "Account · Security",
    description:
      "Two-factor authentication (TOTP). Enable or disable MFA from here.",
    keywords: [
      "security",
      "2fa",
      "two factor",
      "mfa",
      "totp",
      "authenticator",
      "google authenticator",
      "authy",
    ],
    audience: "all",
  },
  {
    id: "dashboard-marketing",
    url: "/dashboards/marketing-overview",
    title: "Marketing Overview",
    description:
      "HubSpot pipeline value (weighted + unweighted), ad spend, inbound leads, and rep handoff rate.",
    keywords: [
      "marketing",
      "pipeline value",
      "ad spend",
      "ads",
      "google ads",
      "linkedin ads",
      "leads",
      "typeform",
      "handoff",
      "overview",
    ],
    audience: "admin",
  },
  {
    id: "dashboard-pipeline-analytics",
    url: "/dashboards/pipeline-analytics",
    title: "Pipeline Analytics",
    description:
      "Top-line pipeline totals and per-rep breakdown across both HubSpot pipelines.",
    keywords: [
      "pipeline analytics",
      "per rep",
      "by rep",
      "rep performance",
      "weighted pipeline",
      "unweighted pipeline",
    ],
    audience: "admin",
  },
  {
    id: "dashboard-sales-pipeline",
    url: "/dashboards/sales-pipeline",
    title: "New Logo Pipeline",
    description: "Kanban view of open deals in the HubSpot New Logo Pipeline.",
    keywords: [
      "new logo",
      "sales pipeline",
      "deals",
      "kanban",
      "new customers",
      "prospects",
    ],
    audience: "admin",
  },
  {
    id: "dashboard-account-expansion",
    url: "/dashboards/account-expansion",
    title: "Wallet Share Pipeline",
    description:
      "Kanban view of open deals in the HubSpot Wallet Share Pipeline (expansion).",
    keywords: [
      "wallet share",
      "expansion",
      "account expansion",
      "upsell",
      "existing customer pipeline",
    ],
    audience: "admin",
  },
  {
    id: "dashboard-account-penetration",
    url: "/dashboards/account-penetration",
    title: "Account Penetration",
    description:
      "Per-account progress bars — wallet share won and in progress against each account's initial Sales Pipeline projection.",
    keywords: [
      "penetration",
      "account share",
      "share of wallet",
      "won vs projection",
    ],
    audience: "admin",
  },
  {
    id: "dashboard-orders-backlog",
    url: "/dashboards/orders-backlog",
    title: "Orders Backlog",
    description:
      "Open PO backlog value at each snapshot point — quarterly 2024–2025, then monthly.",
    keywords: ["backlog", "open po", "po backlog", "snapshot", "historical"],
    audience: "admin",
  },
  {
    id: "dashboard-orders-portal",
    url: "/dashboards/orders-portal",
    title: "Order Tracker",
    description:
      "Booked POs by customer for the year — editable spreadsheet seeded from the 2026 POs workbook.",
    keywords: [
      "order tracker",
      "orders portal",
      "booked",
      "po grid",
      "2026 orders",
      "monthly orders",
    ],
    audience: "admin",
  },
  {
    id: "admin-users",
    url: "/admin/users",
    title: "Admin · Users",
    description: "Invite, edit, or disable portal users. Reset MFA for users.",
    keywords: [
      "users",
      "invite user",
      "add user",
      "manage users",
      "reset mfa",
      "disable user",
      "admin users",
    ],
    audience: "admin",
  },
  {
    id: "admin-tickets",
    url: "/admin/tickets",
    title: "Admin · Tickets",
    description: "Customer feedback and complaint tickets.",
    keywords: ["tickets", "feedback", "complaints", "support tickets"],
    audience: "admin",
  },
  {
    id: "admin-tickets-analytics",
    url: "/admin/tickets/analytics",
    title: "Admin · Tickets · Analytics",
    description: "Ticket volume and resolution analytics.",
    keywords: ["ticket analytics", "ticket volume", "resolution time"],
    audience: "admin",
  },
  {
    id: "contact",
    url: "/contact",
    title: "Contact",
    description: "WB Blends contact info and points-of-contact.",
    keywords: ["contact", "phone", "address", "who to call", "support"],
    audience: "all",
  },
  {
    id: "quality",
    url: "/quality",
    title: "Quality",
    description: "Quality documents, certificates, and COA references.",
    keywords: ["quality", "coa", "certificates", "qc", "qa"],
    audience: "all",
  },
  {
    id: "documents",
    url: "/documents",
    title: "Documents",
    description: "Shared documents library.",
    keywords: ["documents", "files", "downloads", "shared"],
    audience: "all",
  },
  {
    id: "invoices",
    url: "/invoices",
    title: "Invoices",
    description: "View invoices and open balances.",
    keywords: ["invoices", "billing", "open balance", "ar", "accounts receivable"],
    audience: "all",
  },
];

/**
 * Find the best-matching navigation target for a topic. Simple scoring: exact
 * title match wins, then keyword hits, then description hits. Returns up to
 * `limit` matches sorted high-to-low.
 */
export function searchNavigationTargets(
  topic: string,
  audience: NavigationAudience[],
  limit = 3,
): NavigationTarget[] {
  const q = topic.toLowerCase().trim();
  if (!q) return [];
  const allowed = new Set(audience);
  const scored = NAVIGATION_TARGETS.filter(t => allowed.has(t.audience)).map(
    t => {
      let score = 0;
      const title = t.title.toLowerCase();
      const desc = t.description.toLowerCase();
      if (title === q || title.includes(q) || q.includes(title)) score += 10;
      for (const kw of t.keywords) {
        if (q.includes(kw)) score += 5;
        else if (kw.includes(q) && q.length >= 3) score += 2;
      }
      if (desc.includes(q)) score += 1;
      return { t, score };
    },
  );
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.t);
}
