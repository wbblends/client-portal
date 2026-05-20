/**
 * Tool definitions and handlers for the magical search bar's AI bot.
 *
 * Each tool is read-only and either:
 *   (a) returns a deep link into the portal (`navigate_portal`)
 *   (b) returns metadata about the current user (`get_my_profile`)
 *   (c) wraps an existing data-layer function the marketing/orders dashboards
 *       already use, so the bot inherits whatever caching those layers do.
 *
 * Tools are gated by role at dispatch time: each tool declares an `audience`
 * (`all` or `admin`), and the bot route filters the tool list by the
 * signed-in user's role before sending it to the model. The handler also
 * re-checks the role server-side — defense in depth.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { isAdminRole, type UserRole } from "@/lib/users/store";
import {
  searchNavigationTargets,
  type NavigationAudience,
} from "@/lib/ai-bot/navigation-targets";
import { getPipelineSummary, getTypeformLeadStats } from "@/lib/marketing/hubspot";
import { getAdAnalytics } from "@/lib/marketing/hubspot-analytics";
import { listOrdersRows } from "@/lib/orders/store";

export type ToolAudience = "all" | "admin";

export type BotContext = {
  username: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  mfaEnabled: boolean;
  avatarUrl: string | null;
};

type ToolHandler<I = Record<string, unknown>> = (
  input: I,
  ctx: BotContext,
) => Promise<unknown>;

type ToolEntry = {
  audience: ToolAudience;
  definition: Anthropic.Tool;
  handler: ToolHandler;
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: navigate_portal — available to everyone
 * ──────────────────────────────────────────────────────────────────────── */

const navigatePortal: ToolEntry = {
  audience: "all",
  definition: {
    name: "navigate_portal",
    description:
      "Look up a portal page by topic or intent (e.g. 'profile', 'change my password', 'pipeline analytics', 'orders'). Returns up to 3 matching destinations with their URLs and a one-line description of what the page does. Use this whenever the user asks 'where do I…?' or 'how do I…?' — even for self-serve actions like updating photo, enabling 2FA, or resetting password.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Free-text topic or intent, e.g. 'profile photo', 'two factor', 'wallet share pipeline', 'invoices'.",
        },
      },
      required: ["topic"],
    },
  },
  handler: async (input, ctx) => {
    const topic = String((input as { topic?: unknown }).topic ?? "");
    const audiences: NavigationAudience[] = ["all"];
    if (isAdminRole(ctx.role)) audiences.push("admin");
    if (ctx.role === "customer") audiences.push("customer");
    const hits = searchNavigationTargets(topic, audiences, 3);
    return {
      query: topic,
      matches: hits.map(h => ({
        url: h.url,
        title: h.title,
        description: h.description,
      })),
      note:
        hits.length === 0
          ? "No matching pages found. You can suggest the user open the sidebar to browse, or ask them to clarify the topic."
          : "Return these as markdown links the user can click, e.g. [Profile](/account/profile).",
    };
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: get_my_profile — available to everyone
 * ──────────────────────────────────────────────────────────────────────── */

const getMyProfile: ToolEntry = {
  audience: "all",
  definition: {
    name: "get_my_profile",
    description:
      "Return basic info about the signed-in user (name, email, role, company, MFA status, whether they have a profile photo). Use when the user asks about themselves ('what's my role?', 'do I have 2FA on?', 'what's my email here?').",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async (_input, ctx) => {
    return {
      username: ctx.username,
      name: ctx.name,
      email: ctx.email,
      company: ctx.company,
      role: ctx.role,
      isAdmin: isAdminRole(ctx.role),
      mfaEnabled: ctx.mfaEnabled,
      hasAvatar: !!ctx.avatarUrl,
    };
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: get_pipeline_summary — admin only
 * ──────────────────────────────────────────────────────────────────────── */

const getPipelineSummaryTool: ToolEntry = {
  audience: "admin",
  definition: {
    name: "get_pipeline_summary",
    description:
      "Fetch current HubSpot pipeline totals across both pipelines (New Logo + Wallet Share). Returns unweighted dollar value, weighted (probability-adjusted) value, and deal count per pipeline plus a combined total. Use for questions like 'what's my pipeline at?', 'how much weighted pipeline do we have?', 'how many open deals?'.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async (_input, ctx) => {
    if (!isAdminRole(ctx.role)) return { error: "Admin only." };
    const summary = await getPipelineSummary();
    return summary;
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: get_typeform_leads — admin only
 * ──────────────────────────────────────────────────────────────────────── */

const getTypeformLeadsTool: ToolEntry = {
  audience: "admin",
  definition: {
    name: "get_typeform_leads",
    description:
      "Inbound lead counts from Typeform (synced to HubSpot as contacts). Returns counts over the last 7, 30, and 90 days plus all-time total. Use for 'how many leads this month?', 'inbound this week?', 'lead volume'.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async (_input, ctx) => {
    if (!isAdminRole(ctx.role)) return { error: "Admin only." };
    const stats = await getTypeformLeadStats();
    return stats;
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: get_ad_traffic — admin only
 * ──────────────────────────────────────────────────────────────────────── */

const getAdTraffic: ToolEntry = {
  audience: "admin",
  definition: {
    name: "get_ad_traffic",
    description:
      "Paid-traffic analytics from HubSpot for Google + LinkedIn over a recent window. Returns per-network visits, visitors, contacts created, bounce rate, and time-on-site, plus combined totals and the comparison-period delta. Useful for 'how are the ads doing?', 'LinkedIn traffic last 30 days', 'paid contacts this quarter'. NOTE: HubSpot exposes traffic metrics, not raw ad spend dollars — answer questions about *traffic and contacts*, and when asked specifically about spend, say spend isn't available through this tool.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description:
            "Window length in days (default 30). Compared against the previous equal-length window.",
          default: 30,
        },
      },
      required: [],
    },
  },
  handler: async (input, ctx) => {
    if (!isAdminRole(ctx.role)) return { error: "Admin only." };
    const days = Math.max(
      1,
      Math.min(365, Number((input as { days?: unknown }).days) || 30),
    );
    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    const compareFrom = new Date(from.getTime() - days * 86_400_000);
    const summary = await getAdAnalytics(
      { from, to: now },
      { from: compareFrom, to: from },
    );
    // Drop the daily array — too noisy for a chat answer, the model doesn't
    // need 30 daily points to summarize a window.
    return {
      source: summary.source,
      window_days: days,
      byNetwork: summary.byNetwork,
      combined: summary.combined,
      combinedCompare: summary.combinedCompare,
    };
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Tool: get_orders_portal_snapshot — admin only
 * ──────────────────────────────────────────────────────────────────────── */

const getOrdersPortalSnapshot: ToolEntry = {
  audience: "admin",
  definition: {
    name: "get_orders_portal_snapshot",
    description:
      "Snapshot of the Order Tracker grid: how many customers, total booked YTD, top customers by booked revenue, and per-tier breakdown. Use for 'how are orders looking?', 'who's our biggest customer this year?', 'YTD bookings'.",
    input_schema: {
      type: "object",
      properties: {
        top_n: {
          type: "integer",
          description: "Number of top customers to return (default 5, max 20).",
          default: 5,
        },
      },
      required: [],
    },
  },
  handler: async (input, ctx) => {
    if (!isAdminRole(ctx.role)) return { error: "Admin only." };
    const topN = Math.max(
      1,
      Math.min(20, Number((input as { top_n?: unknown }).top_n) || 5),
    );
    const rows = await listOrdersRows();
    type RowSummary = {
      customer: string;
      rep: string;
      tier: string;
      booked_ytd: number;
      months_with_data: number;
    };
    const summarized: RowSummary[] = rows.map(r => {
      const months = r.months ?? [];
      const booked = months.reduce(
        (s: number, v) => s + (typeof v === "number" ? v : 0),
        0,
      );
      const filled = months.filter(v => typeof v === "number").length;
      return {
        customer: r.customer,
        rep: r.rep,
        tier: r.tier || "—",
        booked_ytd: booked,
        months_with_data: filled,
      };
    });
    summarized.sort((a, b) => b.booked_ytd - a.booked_ytd);
    const total_booked = summarized.reduce((s, r) => s + r.booked_ytd, 0);
    const tierTotals: Record<string, { customers: number; booked: number }> = {};
    for (const r of summarized) {
      const k = r.tier || "—";
      tierTotals[k] ??= { customers: 0, booked: 0 };
      tierTotals[k].customers += 1;
      tierTotals[k].booked += r.booked_ytd;
    }
    return {
      total_customers: summarized.length,
      total_booked_ytd: total_booked,
      top_customers: summarized.slice(0, topN),
      by_tier: tierTotals,
    };
  },
};

/* ────────────────────────────────────────────────────────────────────────
 *   Registry
 * ──────────────────────────────────────────────────────────────────────── */

const ALL_TOOLS: Record<string, ToolEntry> = {
  navigate_portal: navigatePortal,
  get_my_profile: getMyProfile,
  get_pipeline_summary: getPipelineSummaryTool,
  get_typeform_leads: getTypeformLeadsTool,
  get_ad_traffic: getAdTraffic,
  get_orders_portal_snapshot: getOrdersPortalSnapshot,
};

/** Tool definitions visible to the model for a given role. */
export function toolDefinitionsFor(role: UserRole): Anthropic.Tool[] {
  const allowAdmin = isAdminRole(role);
  return Object.values(ALL_TOOLS)
    .filter(t => t.audience === "all" || allowAdmin)
    .map(t => t.definition);
}

/** Resolve a tool call. Unknown tool names return an error object instead of
 *  throwing, so the model can recover gracefully. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: BotContext,
): Promise<unknown> {
  const entry = ALL_TOOLS[name];
  if (!entry) return { error: `Unknown tool: ${name}` };
  if (entry.audience === "admin" && !isAdminRole(ctx.role)) {
    return { error: "This tool is restricted to admins." };
  }
  try {
    return await entry.handler(input as Record<string, unknown>, ctx);
  } catch (err) {
    console.error(`[ai-bot] tool ${name} failed:`, err);
    return {
      error: `Tool ${name} failed`,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
