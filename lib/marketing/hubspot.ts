/**
 * HubSpot data layer for the marketing dashboard.
 *
 * Pulls deal pipeline values (weighted + unweighted) and counts Typeform
 * inbound leads. Typeform leads sync into HubSpot as contacts with the
 * `typeform_response_type` property set, so we don't need a separate Typeform
 * integration — counting them here is sufficient.
 *
 * Auth: a HubSpot Private App token in env var HUBSPOT_PRIVATE_APP_TOKEN.
 * Required scopes: crm.objects.deals.read, crm.objects.contacts.read.
 *
 * When the token is missing we return placeholder data so the dashboard
 * renders during local development — see PLACEHOLDER_DATA below. The
 * `source` field on each return type lets the UI flag mocked sections.
 */

import { cache } from "react";
import { PLACEHOLDER_KANBAN } from "./placeholder-kanban";

const HUBSPOT_API = "https://api.hubapi.com";

// Per-request HubSpot timeout. If a single fetch exceeds this we abort and
// the caller's try/catch falls back to placeholder data — better to render
// stale-but-fast than to hang the whole marketing dashboard on an upstream
// blip. AbortSignal.timeout cancels the underlying socket so we don't leak
// pending requests.
const HUBSPOT_TIMEOUT_MS = 12_000;

function timedFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HUBSPOT_TIMEOUT_MS) });
}

// HubSpot's CRM Search API enforces a tight per-second limit (4 req/sec on
// Free/Starter, 5 on Pro). When the marketing dashboard renders, multiple
// modules issue search calls back-to-back — pipeline summary, Typeform leads,
// attribution. Without coordination they trip the rate limit.
//
// `searchFetch` is a serialized, throttled wrapper used by every search-API
// call site. It (a) chains calls so only one is in flight at a time and
// (b) waits SEARCH_GAP_MS between releases. Module-level state means a single
// queue across all concurrent renders in this Node process, which is the
// behavior we want — HubSpot doesn't care which call site issued the request.
const SEARCH_GAP_MS = 280;
let searchQueueTail: Promise<void> = Promise.resolve();

async function searchFetch(url: string, init: RequestInit): Promise<Response> {
  const prevTail = searchQueueTail;
  let release: () => void = () => {};
  searchQueueTail = new Promise<void>(r => {
    release = r;
  });

  try {
    await prevTail;
    let res = await timedFetch(url, init);
    if (res.status === 429) {
      // Honor Retry-After if present (HubSpot returns it for SECONDLY limits).
      const retryAfter = Number(res.headers.get("retry-after") ?? 1);
      const waitMs = Math.max(1000, retryAfter * 1000);
      await new Promise(r => setTimeout(r, waitMs));
      res = await timedFetch(url, init);
    }
    return res;
  } finally {
    setTimeout(release, SEARCH_GAP_MS);
  }
}

// Pipeline IDs are stable — discovered from Devin's HubSpot account 20659581.
// Sales Pipeline + Account Expansion are the two we care about for marketing.
// "Upcoming Orders" (794004256) is empty and excluded per Devin.
export const PIPELINES = {
  sales: { id: "698803061", label: "Sales Pipeline" },
  expansion: { id: "756080816", label: "Account Expansion" },
} as const;

export type PipelineKey = keyof typeof PIPELINES;

export type PipelineTotals = {
  unweighted: number;
  weighted: number;
  dealCount: number;
};

export type PipelineSummary = {
  source: "live" | "placeholder";
  perPipeline: Record<PipelineKey, PipelineTotals & { label: string }>;
  combined: PipelineTotals;
};

export type TypeformLeadStats = {
  source: "live" | "placeholder";
  last7d: number;
  last30d: number;
  last90d: number;
  total: number;
};

export type DealTier = "AA" | "A" | "B" | "C";
export type DealFormat = "Liquid" | "Capsule" | "Powder";

export type DealOwner = {
  id: string;
  name: string;
  initials: string;
};

export type DealCard = {
  id: string;
  name: string;
  companyName: string | null;
  companyDomain: string | null;
  amount: number;
  weighted: number;
  closeDate: string | null;
  monthExpected: string | null;
  tier: DealTier | null;
  format: DealFormat | null;
  productCategory: string | null;
  owner: DealOwner | null;
  hubspotUrl: string;
};

export type StageColumn = {
  id: string;
  label: string;
  probability: number;
  isClosed: boolean;
  totalAmount: number;
  dealCount: number;
  deals: DealCard[];
};

export type PipelineKanban = {
  key: PipelineKey;
  label: string;
  stages: StageColumn[];
};

export type KanbanData = {
  source: "live" | "placeholder";
  pipelines: PipelineKanban[];
};

const PLACEHOLDER_PIPELINES: PipelineSummary = {
  source: "placeholder",
  perPipeline: {
    sales: { label: PIPELINES.sales.label, unweighted: 4_250_000, weighted: 2_380_000, dealCount: 18 },
    expansion: {
      label: PIPELINES.expansion.label,
      unweighted: 1_875_000,
      weighted: 612_000,
      dealCount: 24,
    },
  },
  combined: { unweighted: 6_125_000, weighted: 2_992_000, dealCount: 42 },
};

const PLACEHOLDER_TYPEFORM: TypeformLeadStats = {
  source: "placeholder",
  last7d: 12,
  last30d: 47,
  last90d: 138,
  total: 433,
};

function token(): string | null {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? null;
}

async function searchDeals(pipelineId: string): Promise<{ amount: number; weighted: number }[]> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const all: { amount: number; weighted: number }[] = [];
  let after: string | undefined;

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: pipelineId },
            { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
          ],
        },
      ],
      properties: ["amount", "hs_projected_amount"],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Server-component fetch caches by default in Next; opt out so the
      // dashboard always reflects current pipeline state.
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HubSpot deals search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results: { properties: Record<string, string | null> }[];
      paging?: { next?: { after: string } };
    };

    for (const r of data.results) {
      const amount = Number(r.properties.amount ?? 0);
      const weighted = Number(r.properties.hs_projected_amount ?? 0);
      if (Number.isFinite(amount)) all.push({ amount, weighted: Number.isFinite(weighted) ? weighted : 0 });
    }

    after = data.paging?.next?.after;
  } while (after);

  return all;
}

export async function getPipelineSummary(): Promise<PipelineSummary> {
  if (!token()) return PLACEHOLDER_PIPELINES;

  try {
    const [salesDeals, expansionDeals] = await Promise.all([
      searchDeals(PIPELINES.sales.id),
      searchDeals(PIPELINES.expansion.id),
    ]);

    const totals = (deals: { amount: number; weighted: number }[]): PipelineTotals => ({
      unweighted: deals.reduce((s, d) => s + d.amount, 0),
      weighted: deals.reduce((s, d) => s + d.weighted, 0),
      dealCount: deals.length,
    });

    const sales = totals(salesDeals);
    const expansion = totals(expansionDeals);

    return {
      source: "live",
      perPipeline: {
        sales: { label: PIPELINES.sales.label, ...sales },
        expansion: { label: PIPELINES.expansion.label, ...expansion },
      },
      combined: {
        unweighted: sales.unweighted + expansion.unweighted,
        weighted: sales.weighted + expansion.weighted,
        dealCount: sales.dealCount + expansion.dealCount,
      },
    };
  } catch (err) {
    console.error("[marketing/hubspot] getPipelineSummary failed:", err);
    return PLACEHOLDER_PIPELINES;
  }
}

type TypeformContact = { id: number; firstConversionMs: number | null };

/**
 * Paginate through every contact with `typeform_response_type` set, returning
 * the contact id and `first_conversion_date` (as ms since epoch).
 *
 * Wrapped in `React.cache` so the marketing dashboard renders only fetch this
 * list once even though it's consumed by multiple downstream functions
 * (Typeform stats and marketing attribution). Without this we'd do two full
 * paginated sweeps and burn through HubSpot's secondly search-API limit.
 */
const fetchAllTypeformContacts = cache(async (): Promise<TypeformContact[]> => {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const out: TypeformContact[] = [];
  let after: string | undefined;

  do {
    const body = {
      filterGroups: [
        {
          filters: [{ propertyName: "typeform_response_type", operator: "HAS_PROPERTY" }],
        },
      ],
      properties: ["first_conversion_date"],
      limit: 200,
      ...(after ? { after } : {}),
    };

    const res = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HubSpot contacts search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results: { id: string; properties: Record<string, string | null> }[];
      paging?: { next?: { after: string } };
    };

    for (const r of data.results) {
      const id = Number(r.id);
      if (!Number.isFinite(id)) continue;
      const raw = r.properties.first_conversion_date;
      const ms = raw ? Date.parse(raw) : NaN;
      out.push({ id, firstConversionMs: Number.isFinite(ms) ? ms : null });
    }

    after = data.paging?.next?.after;
  } while (after);

  return out;
});

async function fetchAllTypeformConversionDates(): Promise<number[]> {
  const contacts = await fetchAllTypeformContacts();
  const dates: number[] = [];
  for (const c of contacts) {
    if (c.firstConversionMs !== null) dates.push(c.firstConversionMs);
  }

  return dates;
}

export async function getTypeformLeadStats(): Promise<TypeformLeadStats> {
  if (!token()) return PLACEHOLDER_TYPEFORM;

  try {
    const dates = await fetchAllTypeformConversionDates();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff = (days: number) => now - days * day;

    const cut7 = cutoff(7);
    const cut30 = cutoff(30);
    const cut90 = cutoff(90);

    let last7d = 0;
    let last30d = 0;
    let last90d = 0;
    for (const ms of dates) {
      if (ms >= cut7) last7d++;
      if (ms >= cut30) last30d++;
      if (ms >= cut90) last90d++;
    }

    return { source: "live", last7d, last30d, last90d, total: dates.length };
  } catch (err) {
    console.error("[marketing/hubspot] getTypeformLeadStats failed:", err);
    return PLACEHOLDER_TYPEFORM;
  }
}

export type RangeLeadCounts = {
  source: "live" | "placeholder";
  inRange: number;
  inCompareRange: number;
  allTime: number;
};

const PLACEHOLDER_RANGE_LEAD_COUNTS: RangeLeadCounts = {
  source: "placeholder",
  inRange: 84,
  inCompareRange: 71,
  allTime: 433,
};

/**
 * Same Typeform contact dataset as `getTypeformLeadStats`, bucketed into a
 * caller-supplied range + compare range so the dashboard's date picker can
 * scope the inbound-leads KPIs.
 */
export async function getTypeformLeadCountsForRange(
  range: { from: Date; to: Date },
  compareRange: { from: Date; to: Date },
): Promise<RangeLeadCounts> {
  if (!token()) return PLACEHOLDER_RANGE_LEAD_COUNTS;
  try {
    const dates = await fetchAllTypeformConversionDates();
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    const cFromMs = compareRange.from.getTime();
    const cToMs = compareRange.to.getTime();
    let inRange = 0;
    let inCompareRange = 0;
    for (const ms of dates) {
      if (ms >= fromMs && ms <= toMs) inRange++;
      if (ms >= cFromMs && ms <= cToMs) inCompareRange++;
    }
    return { source: "live", inRange, inCompareRange, allTime: dates.length };
  } catch (err) {
    console.error("[marketing/hubspot] getTypeformLeadCountsForRange failed:", err);
    return PLACEHOLDER_RANGE_LEAD_COUNTS;
  }
}

type RawStage = {
  id: string;
  label: string;
  displayOrder: number;
  metadata?: { probability?: string; isClosed?: string };
};

async function fetchPipelineStages(pipelineId: string): Promise<RawStage[]> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const res = await timedFetch(`${HUBSPOT_API}/crm/v3/pipelines/deals/${pipelineId}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HubSpot pipeline fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { stages: RawStage[] };
  return [...data.stages].sort((a, b) => a.displayOrder - b.displayOrder);
}

type RawDeal = {
  id: string;
  properties: Record<string, string | null>;
};

async function fetchOpenDeals(pipelineId: string): Promise<RawDeal[]> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const all: RawDeal[] = [];
  let after: string | undefined;

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: pipelineId },
            { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
          ],
        },
      ],
      properties: [
        "dealname",
        "amount",
        "hs_projected_amount",
        "dealstage",
        "closedate",
        "hubspot_owner_id",
        "format",
        "tier",
        "month_expected",
        "product_category",
      ],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HubSpot deals search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results: RawDeal[];
      paging?: { next?: { after: string } };
    };

    all.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return all;
}

type RawOwner = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

async function fetchAllOwners(): Promise<Map<string, DealOwner>> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const map = new Map<string, DealOwner>();
  let after: string | undefined;

  do {
    const url = new URL(`${HUBSPOT_API}/crm/v3/owners`);
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const res = await timedFetch(url, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HubSpot owners fetch failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      results: RawOwner[];
      paging?: { next?: { after: string } };
    };

    for (const o of data.results) {
      const first = (o.firstName ?? "").trim();
      const last = (o.lastName ?? "").trim();
      const name = [first, last].filter(Boolean).join(" ") || o.email || `Owner ${o.id}`;
      const initials = (first[0] ?? "") + (last[0] ?? "") || (o.email?.[0] ?? "?").toUpperCase();
      map.set(o.id, { id: o.id, name, initials: initials.toUpperCase() });
    }

    after = data.paging?.next?.after;
  } while (after);

  return map;
}

function dealHubspotUrl(dealId: string): string {
  // 0-3 is the HubSpot object type id for deals.
  return `https://app.hubspot.com/contacts/20659581/record/0-3/${dealId}`;
}

function asTier(v: string | null | undefined): DealTier | null {
  return v === "AA" || v === "A" || v === "B" || v === "C" ? v : null;
}

function asFormat(v: string | null | undefined): DealFormat | null {
  return v === "Liquid" || v === "Capsule" || v === "Powder" ? v : null;
}

function buildPipelineFromRaw(
  key: PipelineKey,
  stages: RawStage[],
  deals: RawDeal[],
  ownersById: Map<string, DealOwner>,
  dealCompany: Map<string, { name: string; domain: string | null }>,
): PipelineKanban {
  const dealsByStage = new Map<string, DealCard[]>();
  for (const d of deals) {
    const stageId = d.properties.dealstage ?? "";
    const ownerId = d.properties.hubspot_owner_id;
    const company = dealCompany.get(d.id);
    const card: DealCard = {
      id: d.id,
      name: d.properties.dealname ?? "(unnamed deal)",
      companyName: company?.name ?? null,
      companyDomain: company?.domain ?? null,
      amount: Number(d.properties.amount ?? 0) || 0,
      weighted: Number(d.properties.hs_projected_amount ?? 0) || 0,
      closeDate: d.properties.closedate,
      monthExpected: d.properties.month_expected ?? null,
      tier: asTier(d.properties.tier),
      format: asFormat(d.properties.format),
      productCategory: d.properties.product_category ?? null,
      owner: ownerId ? ownersById.get(ownerId) ?? null : null,
      hubspotUrl: dealHubspotUrl(d.id),
    };
    if (!dealsByStage.has(stageId)) dealsByStage.set(stageId, []);
    dealsByStage.get(stageId)!.push(card);
  }

  return {
    key,
    label: PIPELINES[key].label,
    stages: stages
      .filter(s => s.metadata?.isClosed !== "true")
      .map(s => {
        const stageDeals = dealsByStage.get(s.id) ?? [];
        stageDeals.sort((a, b) => b.amount - a.amount);
        return {
          id: s.id,
          label: s.label,
          probability: Number(s.metadata?.probability ?? 0) || 0,
          isClosed: false,
          totalAmount: stageDeals.reduce((sum, d) => sum + d.amount, 0),
          dealCount: stageDeals.length,
          deals: stageDeals,
        };
      }),
  };
}

/**
 * Resolve deal → primary company name for the given deal IDs. Two batch
 * requests: associations (deal → company id), then company name lookup.
 * Both endpoints sit outside the search-API rate limit, so we don't need to
 * route them through searchFetch.
 */
async function resolveDealCompanyInfo(
  dealIds: string[],
): Promise<Map<string, { name: string; domain: string | null }>> {
  const t = token();
  if (!t || dealIds.length === 0) return new Map();

  const dealToCompany = new Map<string, number>();
  for (let i = 0; i < dealIds.length; i += 100) {
    const chunk = dealIds.slice(i, i + 100);
    const res = await timedFetch(`${HUBSPOT_API}/crm/v4/associations/deal/company/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: chunk.map(id => ({ id })) }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HubSpot deal→company assoc read failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      results?: { from: { id: string }; to: { toObjectId: number }[] }[];
    };
    for (const r of data.results ?? []) {
      const first = r.to[0]?.toObjectId;
      if (first != null) dealToCompany.set(r.from.id, first);
    }
  }

  const companyIds = Array.from(new Set(dealToCompany.values()));
  const companyInfo = await batchReadCompanyInfo(companyIds);

  const out = new Map<string, { name: string; domain: string | null }>();
  for (const [dealId, companyId] of dealToCompany) {
    const info = companyInfo.get(companyId);
    if (info) out.set(dealId, info);
  }
  return out;
}

export async function getPipelineKanban(): Promise<KanbanData> {
  if (!token()) return PLACEHOLDER_KANBAN;

  try {
    const [salesStages, expansionStages, salesDeals, expansionDeals, owners] = await Promise.all([
      fetchPipelineStages(PIPELINES.sales.id),
      fetchPipelineStages(PIPELINES.expansion.id),
      fetchOpenDeals(PIPELINES.sales.id),
      fetchOpenDeals(PIPELINES.expansion.id),
      fetchAllOwners(),
    ]);

    const allDealIds = [...salesDeals, ...expansionDeals].map(d => d.id);
    const dealCompany = await resolveDealCompanyInfo(allDealIds);

    return {
      source: "live",
      pipelines: [
        buildPipelineFromRaw("sales", salesStages, salesDeals, owners, dealCompany),
        buildPipelineFromRaw("expansion", expansionStages, expansionDeals, owners, dealCompany),
      ],
    };
  } catch (err) {
    console.error("[marketing/hubspot] getPipelineKanban failed:", err);
    return PLACEHOLDER_KANBAN;
  }
}

// ─── Marketing attribution ──────────────────────────────────────────────────
//
// Builds a "pipeline value attributable to inbound marketing" number by
// chaining contacts → companies → deals:
//
//   1. Find every contact with `typeform_response_type` set
//      (= came in through the WB Blends Typeform form)
//   2. Resolve each contact's associated companies in HubSpot
//   3. For that set of companies, sum their open deals' amount + weighted value
//
// The set of company NAMES is also exported so the orders module can match
// them against the orders portal customer roster for a "marketing-influenced
// POs YTD" number.

export type MarketingAttribution = {
  source: "live" | "placeholder";
  attributedDealCount: number;
  attributedUnweighted: number;
  attributedWeighted: number;
  /** HubSpot company names that have at least one Typeform-touched contact. */
  touchedCompanyNames: string[];
};

const PLACEHOLDER_ATTRIBUTION: MarketingAttribution = {
  source: "placeholder",
  attributedDealCount: 8,
  attributedUnweighted: 1_240_000,
  attributedWeighted: 622_000,
  touchedCompanyNames: ["Veracity", "Just Ingredients", "Bioptimizers"],
};

async function fetchAllTypeformContactIds(): Promise<number[]> {
  const contacts = await fetchAllTypeformContacts();
  return contacts.map(c => c.id);
}

async function batchReadContactToCompanyAssociations(contactIds: number[]): Promise<Set<number>> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");
  const out = new Set<number>();
  for (let i = 0; i < contactIds.length; i += 100) {
    const chunk = contactIds.slice(i, i + 100);
    const res = await timedFetch(
      `${HUBSPOT_API}/crm/v4/associations/contact/company/batch/read`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: chunk.map(id => ({ id: String(id) })) }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      throw new Error(`HubSpot batch assoc read failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      results?: { from: { id: string }; to: { toObjectId: number }[] }[];
    };
    for (const r of data.results ?? []) {
      for (const t of r.to) out.add(Number(t.toObjectId));
    }
  }
  return out;
}

async function batchReadCompanyInfo(
  companyIds: number[],
): Promise<Map<number, { name: string; domain: string | null }>> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");
  const out = new Map<number, { name: string; domain: string | null }>();
  for (let i = 0; i < companyIds.length; i += 100) {
    const chunk = companyIds.slice(i, i + 100);
    const res = await timedFetch(`${HUBSPOT_API}/crm/v3/objects/companies/batch/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: ["name", "domain"],
        inputs: chunk.map(id => ({ id: String(id) })),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HubSpot batch company read failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      results: { id: string; properties: { name: string | null; domain: string | null } }[];
    };
    for (const r of data.results) {
      const id = Number(r.id);
      if (r.properties.name) {
        out.set(id, { name: r.properties.name, domain: r.properties.domain || null });
      }
    }
  }
  return out;
}

async function searchOpenDealsForCompanies(
  companyIds: number[],
): Promise<{ amount: number; weighted: number }[]> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");
  // Dedupe by deal id — when company IDs span multiple chunks, a deal that's
  // associated with companies in different chunks would otherwise be counted
  // once per chunk it matches, inflating the totals.
  const seen = new Map<string, { amount: number; weighted: number }>();
  for (let i = 0; i < companyIds.length; i += 100) {
    const chunk = companyIds.slice(i, i + 100);
    let after: string | undefined;
    do {
      const body = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "pipeline",
                operator: "IN",
                values: [PIPELINES.sales.id, PIPELINES.expansion.id],
              },
              { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
            ],
            associatedWith: [
              { objectType: "companies", operator: "IN", objectIdValues: chunk },
            ],
          },
        ],
        properties: ["amount", "hs_projected_amount"],
        limit: 100,
        ...(after ? { after } : {}),
      };
      const res = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/deals/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(
          `HubSpot attributed deals search failed: ${res.status} ${await res.text()}`,
        );
      }
      const data = (await res.json()) as {
        results: { id: string; properties: Record<string, string | null> }[];
        paging?: { next?: { after: string } };
      };
      for (const r of data.results) {
        if (seen.has(r.id)) continue;
        const amount = Number(r.properties.amount ?? 0);
        const weighted = Number(r.properties.hs_projected_amount ?? 0);
        if (Number.isFinite(amount)) {
          seen.set(r.id, { amount, weighted: Number.isFinite(weighted) ? weighted : 0 });
        }
      }
      after = data.paging?.next?.after;
    } while (after);
  }
  return Array.from(seen.values());
}

// ─── Deal notes ─────────────────────────────────────────────────────────────
//
// Most recent notes for a single deal, sorted newest first. Used by the deal
// detail modal on the Sales Pipeline / Account Expansion dashboards so the
// rep can glance at recent context without leaving the portal.

export type DealNote = {
  id: string;
  /** Plain-text body. HubSpot stores notes as HTML; we strip tags for safe
   *  rendering — the modal shows them as preformatted text. */
  body: string;
  /** ISO timestamp of when the note was created. */
  timestamp: string | null;
  owner: DealOwner | null;
};

export type DealNotesResult = {
  source: "live" | "placeholder";
  notes: DealNote[];
};

const PLACEHOLDER_NOTES: DealNotesResult = {
  source: "placeholder",
  notes: [],
};

function stripHtml(html: string): string {
  // Replace common block-level closers with newlines so the visual line breaks
  // survive, then strip the remaining tags and decode the handful of HTML
  // entities HubSpot actually emits.
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Look up a HubSpot owner id by email. Used to attribute a note created from
 *  the portal to the right HubSpot user when their portal email matches.
 *  Returns null if no owner has that email. */
async function findOwnerIdByEmail(email: string): Promise<string | null> {
  const t = token();
  if (!t) return null;
  const lower = email.trim().toLowerCase();
  if (!lower) return null;
  let after: string | undefined;
  do {
    const url = new URL(`${HUBSPOT_API}/crm/v3/owners`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("email", lower);
    if (after) url.searchParams.set("after", after);
    const res = await timedFetch(url, {
      headers: { Authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results: RawOwner[];
      paging?: { next?: { after: string } };
    };
    for (const o of data.results) {
      if ((o.email ?? "").toLowerCase() === lower) return o.id;
    }
    after = data.paging?.next?.after;
  } while (after);
  return null;
}

export type CreatedDealNote = {
  source: "live" | "placeholder";
  note: DealNote | null;
  /** If the portal user's email didn't match a HubSpot owner, the note is
   *  still created but unattributed; this flag lets the UI mention it. */
  ownerMatched: boolean;
};

export async function createDealNote(
  dealId: string,
  body: string,
  authorEmail: string,
): Promise<CreatedDealNote> {
  const t = token();
  if (!t) return { source: "placeholder", note: null, ownerMatched: false };
  if (!/^\d+$/.test(dealId)) throw new Error("Invalid deal id");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty note body");

  const ownerId = await findOwnerIdByEmail(authorEmail);

  // HubSpot stores note bodies as HTML; we wrap user input in <p> with line
  // breaks preserved so newlines from the textarea survive a round trip.
  const html = `<p>${trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")}</p>`;

  const payload = {
    properties: {
      hs_note_body: html,
      hs_timestamp: new Date().toISOString(),
      ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
    },
    // Association type 214 is the HubSpot-defined "note → deal" link.
    associations: [
      {
        to: { id: dealId },
        types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
      },
    ],
  };

  const res = await timedFetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HubSpot note create failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    id: string;
    properties: Record<string, string | null>;
  };

  const owners = ownerId ? await fetchAllOwners() : new Map<string, DealOwner>();
  const note: DealNote = {
    id: data.id,
    body: trimmed,
    timestamp: data.properties.hs_timestamp ?? new Date().toISOString(),
    owner: ownerId ? owners.get(ownerId) ?? null : null,
  };
  return { source: "live", note, ownerMatched: ownerId !== null };
}

export async function getDealNotes(dealId: string, limit = 5): Promise<DealNotesResult> {
  if (!token()) return PLACEHOLDER_NOTES;
  if (!/^\d+$/.test(dealId)) return { source: "live", notes: [] };

  try {
    const owners = await fetchAllOwners();
    const t = token()!;

    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "associations.deal", operator: "EQ", value: dealId },
          ],
        },
      ],
      sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
      properties: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
      limit,
    };

    const res = await searchFetch(`${HUBSPOT_API}/crm/v3/objects/notes/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HubSpot notes search failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      results: { id: string; properties: Record<string, string | null> }[];
    };

    const notes: DealNote[] = data.results.map(r => {
      const rawBody = r.properties.hs_note_body ?? "";
      const ownerId = r.properties.hubspot_owner_id;
      return {
        id: r.id,
        body: stripHtml(rawBody),
        timestamp: r.properties.hs_timestamp,
        owner: ownerId ? owners.get(ownerId) ?? null : null,
      };
    });

    return { source: "live", notes };
  } catch (err) {
    console.error("[marketing/hubspot] getDealNotes failed:", err);
    return { source: "live", notes: [] };
  }
}

export async function getMarketingAttribution(): Promise<MarketingAttribution> {
  if (!token()) return PLACEHOLDER_ATTRIBUTION;
  try {
    const contactIds = await fetchAllTypeformContactIds();
    if (contactIds.length === 0) {
      return {
        source: "live",
        attributedDealCount: 0,
        attributedUnweighted: 0,
        attributedWeighted: 0,
        touchedCompanyNames: [],
      };
    }
    const companyIdSet = await batchReadContactToCompanyAssociations(contactIds);
    const companyIds = Array.from(companyIdSet);
    if (companyIds.length === 0) {
      return {
        source: "live",
        attributedDealCount: 0,
        attributedUnweighted: 0,
        attributedWeighted: 0,
        touchedCompanyNames: [],
      };
    }
    const infoMap = await batchReadCompanyInfo(companyIds);
    const touchedCompanyNames = Array.from(infoMap.values(), v => v.name).sort((a, b) =>
      a.localeCompare(b),
    );
    const deals = await searchOpenDealsForCompanies(companyIds);
    return {
      source: "live",
      attributedDealCount: deals.length,
      attributedUnweighted: deals.reduce((s, d) => s + d.amount, 0),
      attributedWeighted: deals.reduce((s, d) => s + d.weighted, 0),
      touchedCompanyNames,
    };
  } catch (err) {
    console.error("[marketing/hubspot] getMarketingAttribution failed:", err);
    return PLACEHOLDER_ATTRIBUTION;
  }
}
