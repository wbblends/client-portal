/**
 * Brand Researcher — HubSpot cross-sync.
 *
 * Given a confirmed brand (name + website), check whether the company already
 * exists in our HubSpot CRM and, if so, surface the useful sales context:
 * owner, lifecycle stage, last activity, and any associated deals (stage,
 * amount, owner, last activity). Lets a rep see "is this account already ours,
 * and who owns it?" before they reach out.
 *
 * Reuses the throttled fetch + Private App token from the marketing HubSpot
 * client. Read-only. Never throws to the caller — returns a typed result with
 * `configured` / `error` so the tool degrades gracefully if HubSpot is down or
 * unconfigured.
 */
import { timedFetch, searchFetch } from "@/lib/marketing/hubspot-throttle";

const HUBSPOT_API = "https://api.hubapi.com";
const PORTAL_ID = "20659581"; // same portal the marketing dashboard links into

const PIPELINE_LABELS: Record<string, string> = {
  "698803061": "New Logo Pipeline",
  "756080816": "Wallet Share Pipeline",
};

export type CrmOwner = {
  name: string;
  email: string | null;
};

export type CrmDeal = {
  id: string;
  name: string;
  stage: string;
  pipeline: string;
  amount: number | null;
  isClosed: boolean;
  isWon: boolean;
  owner: CrmOwner | null;
  lastActivity: string | null; // ISO
  closeDate: string | null; // ISO
  url: string;
};

export type CrmCompany = {
  id: string;
  name: string;
  domain: string | null;
  lifecycleStage: string | null;
  owner: CrmOwner | null;
  lastActivity: string | null; // ISO
  annualRevenue: number | null;
  employees: number | null;
  url: string;
};

export type CrmLookup =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      inHubspot: false;
    }
  | {
      configured: true;
      inHubspot: true;
      company: CrmCompany;
      deals: CrmDeal[];
    };

function token(): string | null {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? null;
}

/** Strip a URL/host down to its bare registrable domain for matching. */
function toDomain(website: string): string {
  return website
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

type RawObject = { id: string; properties: Record<string, string | null> };

export async function lookupCompanyInHubspot(args: {
  name: string;
  website?: string;
}): Promise<CrmLookup> {
  const t = token();
  if (!t) return { configured: false };

  const auth = { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
  const domain = args.website ? toDomain(args.website) : "";

  try {
    // ── 1. Find the company (domain match first, then name) ──
    const filterGroups: unknown[] = [];
    if (domain) {
      filterGroups.push({
        filters: [{ propertyName: "domain", operator: "CONTAINS_TOKEN", value: domain }],
      });
    }
    if (args.name) {
      filterGroups.push({
        filters: [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: args.name }],
      });
    }
    if (filterGroups.length === 0) return { configured: true, inHubspot: false };

    const companyRes = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/companies/search`, {
      method: "POST",
      headers: auth,
      cache: "no-store",
      body: JSON.stringify({
        filterGroups,
        properties: [
          "name",
          "domain",
          "lifecyclestage",
          "hubspot_owner_id",
          "annualrevenue",
          "numberofemployees",
          "notes_last_updated",
          "hs_last_sales_activity_timestamp",
          "hs_lastmodifieddate",
        ],
        limit: 5,
      }),
    });
    if (!companyRes.ok) {
      return { configured: true, error: `HubSpot company search failed (${companyRes.status}).` };
    }
    const companyData = (await companyRes.json()) as { results?: RawObject[] };
    const results = companyData.results ?? [];
    if (results.length === 0) return { configured: true, inHubspot: false };

    // Prefer an exact-domain hit; otherwise take the top result.
    const best =
      (domain &&
        results.find((r) => (r.properties.domain ?? "").toLowerCase().includes(domain))) ||
      results[0];
    const p = best.properties;

    // ── 2. Associated deals ──
    let dealIds: string[] = [];
    try {
      const assocRes = await timedFetch(
        `${HUBSPOT_API}/crm/v4/objects/companies/${best.id}/associations/deals?limit=25`,
        { headers: auth, cache: "no-store" },
      );
      if (assocRes.ok) {
        const assoc = (await assocRes.json()) as { results?: { toObjectId: string }[] };
        dealIds = (assoc.results ?? []).map((r) => r.toObjectId).slice(0, 12);
      }
    } catch {
      /* deals are best-effort */
    }

    let deals: RawObject[] = [];
    if (dealIds.length > 0) {
      const dealRes = await timedFetch(`${HUBSPOT_API}/crm/v3/objects/deals/batch/read`, {
        method: "POST",
        headers: auth,
        cache: "no-store",
        body: JSON.stringify({
          inputs: dealIds.map((id) => ({ id })),
          properties: [
            "dealname",
            "dealstage",
            "pipeline",
            "amount",
            "closedate",
            "hubspot_owner_id",
            "hs_is_closed",
            "hs_is_closed_won",
            "hs_last_sales_activity_timestamp",
            "hs_lastmodifieddate",
          ],
        }),
      });
      if (dealRes.ok) {
        const d = (await dealRes.json()) as { results?: RawObject[] };
        deals = d.results ?? [];
      }
    }

    // ── 3. Resolve owners (company + deal owners), deduped ──
    const ownerIds = new Set<string>();
    if (p.hubspot_owner_id) ownerIds.add(p.hubspot_owner_id);
    for (const d of deals) if (d.properties.hubspot_owner_id) ownerIds.add(d.properties.hubspot_owner_id);
    const owners = await resolveOwners(ownerIds, auth);

    const company: CrmCompany = {
      id: best.id,
      name: str(p.name) ?? args.name,
      domain: str(p.domain),
      lifecycleStage: str(p.lifecyclestage),
      owner: p.hubspot_owner_id ? owners.get(p.hubspot_owner_id) ?? null : null,
      lastActivity: str(p.hs_last_sales_activity_timestamp) ?? str(p.notes_last_updated),
      annualRevenue: num(p.annualrevenue),
      employees: num(p.numberofemployees),
      url: `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-2/${best.id}`,
    };

    const mappedDeals: CrmDeal[] = deals
      .map((d): CrmDeal => {
        const dp = d.properties;
        return {
          id: d.id,
          name: str(dp.dealname) ?? "Untitled deal",
          stage: str(dp.dealstage) ?? "—",
          pipeline: PIPELINE_LABELS[dp.pipeline ?? ""] ?? str(dp.pipeline) ?? "—",
          amount: num(dp.amount),
          isClosed: dp.hs_is_closed === "true",
          isWon: dp.hs_is_closed_won === "true",
          owner: dp.hubspot_owner_id ? owners.get(dp.hubspot_owner_id) ?? null : null,
          lastActivity: str(dp.hs_last_sales_activity_timestamp),
          closeDate: str(dp.closedate),
          url: `https://app.hubspot.com/contacts/${PORTAL_ID}/record/0-3/${d.id}`,
        };
      })
      // Open deals first, then most recently active.
      .sort((a, b) => {
        if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
        return (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "");
      });

    return { configured: true, inHubspot: true, company, deals: mappedDeals };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : "HubSpot lookup failed.",
    };
  }
}

async function resolveOwners(
  ids: Set<string>,
  auth: Record<string, string>,
): Promise<Map<string, CrmOwner>> {
  const map = new Map<string, CrmOwner>();
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const res = await timedFetch(`${HUBSPOT_API}/crm/v3/owners/${id}`, {
          headers: auth,
          cache: "no-store",
        });
        if (!res.ok) return;
        const o = (await res.json()) as {
          firstName?: string;
          lastName?: string;
          email?: string;
        };
        const name =
          [o.firstName, o.lastName].filter(Boolean).join(" ").trim() ||
          o.email ||
          `Owner ${id}`;
        map.set(id, { name, email: o.email ?? null });
      } catch {
        /* skip unresolvable owner */
      }
    }),
  );
  return map;
}

/** Compact, plain-text CRM summary to feed the research model so its outreach
 *  recommendation accounts for any existing ownership / relationship. */
export function crmSummaryForPrompt(lookup: CrmLookup): string {
  if (!("configured" in lookup) || !lookup.configured) return "";
  if ("error" in lookup) return "";
  if (!lookup.inHubspot) {
    return "CRM status: This company is NOT in our HubSpot — treat as a net-new prospect.";
  }
  const c = lookup.company;
  const lines = [
    `CRM status: Already in our HubSpot${c.owner ? `, owned by ${c.owner.name}` : " (no owner assigned)"}.`,
    c.lifecycleStage ? `Lifecycle stage: ${c.lifecycleStage}.` : "",
    c.lastActivity ? `Last sales activity: ${c.lastActivity.slice(0, 10)}.` : "",
  ];
  if (lookup.deals.length) {
    const open = lookup.deals.filter((d) => !d.isClosed);
    lines.push(
      `Deals (${lookup.deals.length}): ` +
        lookup.deals
          .slice(0, 6)
          .map(
            (d) =>
              `${d.name} [${d.pipeline}, ${d.stage}${
                d.amount ? `, $${Math.round(d.amount).toLocaleString()}` : ""
              }${d.owner ? `, owner ${d.owner.name}` : ""}${d.isClosed ? `, ${d.isWon ? "won" : "closed-lost"}` : ", open"}]`,
          )
          .join("; "),
    );
    if (open.length) {
      lines.push(
        `There ${open.length === 1 ? "is" : "are"} ${open.length} OPEN deal${open.length === 1 ? "" : "s"} — coordinate with the deal owner before any outreach.`,
      );
    }
  }
  return lines.filter(Boolean).join("\n");
}
