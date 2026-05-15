/**
 * HubSpot Analytics (paid traffic + engagement).
 *
 * HubSpot does not expose ad impressions / CTR / spend through any public API
 * (those live behind a private CRM scope used only by the HubSpot UI). What
 * IS exposed is post-click engagement on incoming traffic, broken down by
 * source — which is what this module surfaces.
 *
 * Source: /analytics/v2/reports/sources/total + /daily
 * Auth: HUBSPOT_PRIVATE_APP_TOKEN (no extra scope required beyond what the
 * dashboard already uses).
 *
 * Traffic-source taxonomy as returned by the analytics API:
 *   - "paid"        = paid search   (Google Ads, Bing, etc.)
 *   - "paid-social" = paid social   (LinkedIn, Meta, etc.)
 *   - "direct" / "organic" / "referrals" / "social" / "email" / "offline"
 */

import { unstable_cache } from "next/cache";

const HUBSPOT_API = "https://api.hubapi.com";
const HUBSPOT_TIMEOUT_MS = 12_000;

function timedFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HUBSPOT_TIMEOUT_MS) });
}

function token(): string | null {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? null;
}

/** YYYYMMDD — analytics API rejects dashes in start/end. */
function toApiDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export type AdNetwork = "google" | "linkedin";

export type NetworkMetrics = {
  network: AdNetwork;
  label: string;
  /** Sessions arriving from this paid network. For paid sources, this equals
   *  ad clicks that landed on the site. HubSpot does not separate "clicks
   *  that didn't load" from "clicks that did" — every counted visit is a
   *  successful landing. */
  visits: number;
  /** Unique visitors. visits / visitors > 1 means repeat clicks. */
  visitors: number;
  /** Pageviews across all paid sessions. */
  pageviews: number;
  /** Sessions that bounced (single-page, short-duration). */
  bounces: number;
  /** 0–1 share of sessions that bounced. */
  bounceRate: number;
  /** Avg seconds per session — engagement quality. */
  timePerSession: number;
  /** Pages viewed per session — engagement quality. */
  pageviewsPerSession: number;
  /** New contacts created on the site that were attributed to this source. */
  contacts: number;
  /** 0–1 share of sessions from never-seen-before visitors. */
  newVisitorSessionRate: number;
};

export type AdAnalyticsSummary = {
  source: "live" | "placeholder";
  range: { from: Date; to: Date };
  /** Per-network breakdown for the headline cards. */
  byNetwork: NetworkMetrics[];
  /** Combined paid totals (Google + LinkedIn). */
  combined: Omit<NetworkMetrics, "network" | "label">;
  /** Combined paid totals over the compare range (previous N days / SPLY). */
  combinedCompare: Omit<NetworkMetrics, "network" | "label">;
  /** Daily series for the trend chart. */
  daily: AdDailyPoint[];
  /** Traffic-share breakdown for the donut: paid vs other sources. */
  trafficShare: TrafficShareSlice[];
};

export type AdDailyPoint = {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  google: number;
  linkedin: number;
};

export type TrafficShareSlice = {
  /** Raw HubSpot source key — direct, paid, paid-social, organic, referrals, social, email, offline. */
  key: string;
  /** Display name for the slice. */
  label: string;
  visits: number;
  share: number;
  isPaid: boolean;
};

/** HubSpot uses "paid" for paid search (Google) and "paid-social" for paid
 *  social (LinkedIn). These are stable identifiers in the analytics API. */
const NETWORK_KEY: Record<AdNetwork, string> = {
  google: "paid",
  linkedin: "paid-social",
};

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  paid: "Paid search",
  "paid-social": "Paid social",
  organic: "Organic search",
  referrals: "Referrals",
  social: "Organic social",
  email: "Email",
  offline: "Offline",
  other: "Other",
};

type SourceRow = {
  breakdown: string;
  visits?: number;
  visitors?: number;
  rawViews?: number;
  bounces?: number;
  bounceRate?: number;
  timePerSession?: number;
  pageviewsPerSession?: number;
  contacts?: number;
  newVisitorSessionRate?: number;
};

type SourcesResponse = {
  totals?: SourceRow;
  breakdowns?: SourceRow[];
};

async function fetchSourcesTotal(
  from: Date,
  to: Date,
): Promise<SourcesResponse> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const url = new URL(`${HUBSPOT_API}/analytics/v2/reports/sources/total`);
  url.searchParams.set("start", toApiDate(from));
  url.searchParams.set("end", toApiDate(to));

  const res = await timedFetch(url, {
    headers: { Authorization: `Bearer ${t}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HubSpot analytics sources fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as SourcesResponse;
}

/**
 * Daily breakdown across the range. HubSpot returns a map of date → array of
 * source rows (one row per source that had traffic that day). We pluck out
 * paid + paid-social for each day to feed the trend chart.
 */
async function fetchSourcesDaily(
  from: Date,
  to: Date,
): Promise<Record<string, SourceRow[]>> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");

  const url = new URL(`${HUBSPOT_API}/analytics/v2/reports/sources/daily`);
  url.searchParams.set("start", toApiDate(from));
  url.searchParams.set("end", toApiDate(to));

  const res = await timedFetch(url, {
    headers: { Authorization: `Bearer ${t}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HubSpot analytics daily fetch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Record<string, SourceRow[]>;
}

function emptyNetworkMetrics(network: AdNetwork): NetworkMetrics {
  return {
    network,
    label: network === "google" ? "Google Ads (paid search)" : "LinkedIn Ads (paid social)",
    visits: 0,
    visitors: 0,
    pageviews: 0,
    bounces: 0,
    bounceRate: 0,
    timePerSession: 0,
    pageviewsPerSession: 0,
    contacts: 0,
    newVisitorSessionRate: 0,
  };
}

function rowToMetrics(network: AdNetwork, row: SourceRow | undefined): NetworkMetrics {
  const base = emptyNetworkMetrics(network);
  if (!row) return base;
  return {
    ...base,
    visits: row.visits ?? 0,
    visitors: row.visitors ?? 0,
    pageviews: row.rawViews ?? 0,
    bounces: row.bounces ?? 0,
    bounceRate: row.bounceRate ?? 0,
    timePerSession: row.timePerSession ?? 0,
    pageviewsPerSession: row.pageviewsPerSession ?? 0,
    contacts: row.contacts ?? 0,
    newVisitorSessionRate: row.newVisitorSessionRate ?? 0,
  };
}

function combineMetrics(rows: NetworkMetrics[]): Omit<NetworkMetrics, "network" | "label"> {
  const visits = rows.reduce((s, r) => s + r.visits, 0);
  const visitors = rows.reduce((s, r) => s + r.visitors, 0);
  const pageviews = rows.reduce((s, r) => s + r.pageviews, 0);
  const bounces = rows.reduce((s, r) => s + r.bounces, 0);
  const contacts = rows.reduce((s, r) => s + r.contacts, 0);
  // Weighted recomputation — averaging raw bounceRate across networks
  // misrepresents the combined experience when the two have very different
  // visit volumes (LinkedIn had 2200 visits, Google 78 YTD when this was
  // written — a straight average would skew toward whichever network had
  // worse bounce on lower volume).
  const bounceRate = visits > 0 ? bounces / visits : 0;
  const pageviewsPerSession = visits > 0 ? pageviews / visits : 0;
  // timePerSession is weighted by visits, not by time, so we reconstruct
  // total time first.
  const totalTime = rows.reduce((s, r) => s + r.timePerSession * r.visits, 0);
  const timePerSession = visits > 0 ? totalTime / visits : 0;
  const newVisits = rows.reduce(
    (s, r) => s + r.newVisitorSessionRate * r.visits,
    0,
  );
  const newVisitorSessionRate = visits > 0 ? newVisits / visits : 0;
  return {
    visits,
    visitors,
    pageviews,
    bounces,
    bounceRate,
    timePerSession,
    pageviewsPerSession,
    contacts,
    newVisitorSessionRate,
  };
}

function buildTrafficShare(rows: SourceRow[], totalVisits: number): TrafficShareSlice[] {
  const slices: TrafficShareSlice[] = rows
    .map(r => {
      const visits = r.visits ?? 0;
      return {
        key: r.breakdown,
        label: SOURCE_LABELS[r.breakdown] ?? r.breakdown,
        visits,
        share: totalVisits > 0 ? visits / totalVisits : 0,
        isPaid: r.breakdown === "paid" || r.breakdown === "paid-social",
      };
    })
    .filter(s => s.visits > 0)
    .sort((a, b) => b.visits - a.visits);
  return slices;
}

function buildDailySeries(
  daily: Record<string, SourceRow[]>,
  from: Date,
  to: Date,
): AdDailyPoint[] {
  // Iterate one day at a time so days with zero paid traffic still appear in
  // the series — recharts skips gaps but a flat zero is more honest than an
  // interpolated line.
  const out: AdDailyPoint[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    const rows = daily[key] ?? [];
    const google = rows.find(r => r.breakdown === NETWORK_KEY.google)?.visits ?? 0;
    const linkedin = rows.find(r => r.breakdown === NETWORK_KEY.linkedin)?.visits ?? 0;
    out.push({
      date: key,
      label: cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      google,
      linkedin,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const PLACEHOLDER: AdAnalyticsSummary = {
  source: "placeholder",
  range: { from: new Date(), to: new Date() },
  byNetwork: [
    {
      ...emptyNetworkMetrics("google"),
      visits: 78,
      visitors: 77,
      pageviews: 81,
      bounces: 75,
      bounceRate: 0.962,
      timePerSession: 5.5,
      pageviewsPerSession: 1.04,
      contacts: 2,
      newVisitorSessionRate: 0.987,
    },
    {
      ...emptyNetworkMetrics("linkedin"),
      visits: 2200,
      visitors: 2041,
      pageviews: 2887,
      bounces: 1807,
      bounceRate: 0.821,
      timePerSession: 58.3,
      pageviewsPerSession: 1.31,
      contacts: 18,
      newVisitorSessionRate: 0.928,
    },
  ],
  combined: {
    visits: 2278,
    visitors: 2118,
    pageviews: 2968,
    bounces: 1882,
    bounceRate: 0.826,
    timePerSession: 56.5,
    pageviewsPerSession: 1.3,
    contacts: 20,
    newVisitorSessionRate: 0.93,
  },
  combinedCompare: {
    visits: 1840,
    visitors: 1720,
    pageviews: 2410,
    bounces: 1530,
    bounceRate: 0.832,
    timePerSession: 51.2,
    pageviewsPerSession: 1.27,
    contacts: 14,
    newVisitorSessionRate: 0.94,
  },
  daily: [],
  trafficShare: [
    { key: "direct", label: "Direct", visits: 4609, share: 0.61, isPaid: false },
    { key: "paid-social", label: "Paid social", visits: 2200, share: 0.29, isPaid: true },
    { key: "referrals", label: "Referrals", visits: 353, share: 0.05, isPaid: false },
    { key: "paid", label: "Paid search", visits: 78, share: 0.01, isPaid: true },
    { key: "social", label: "Organic social", visits: 8, share: 0.001, isPaid: false },
    { key: "organic", label: "Organic search", visits: 2, share: 0.0003, isPaid: false },
  ],
};

/**
 * Pull paid-traffic analytics for the supplied range, plus a combined
 * comparison total for the compare range so KPI tiles can render deltas.
 * Falls back to placeholder data if the token is missing or HubSpot fails.
 */
async function _getAdAnalytics(
  fromMs: number,
  toMs: number,
  cFromMs: number,
  cToMs: number,
): Promise<AdAnalyticsSummary> {
  const range = { from: new Date(fromMs), to: new Date(toMs) };
  const compareRange = { from: new Date(cFromMs), to: new Date(cToMs) };
  if (!token()) return { ...PLACEHOLDER, range };

  try {
    const [primary, compare, daily] = await Promise.all([
      fetchSourcesTotal(range.from, range.to),
      fetchSourcesTotal(compareRange.from, compareRange.to),
      fetchSourcesDaily(range.from, range.to),
    ]);

    const findBy = (resp: SourcesResponse, key: string) =>
      resp.breakdowns?.find(b => b.breakdown === key);

    const google = rowToMetrics("google", findBy(primary, NETWORK_KEY.google));
    const linkedin = rowToMetrics("linkedin", findBy(primary, NETWORK_KEY.linkedin));
    const byNetwork: NetworkMetrics[] = [google, linkedin];
    const combined = combineMetrics(byNetwork);

    const compareGoogle = rowToMetrics("google", findBy(compare, NETWORK_KEY.google));
    const compareLinkedin = rowToMetrics("linkedin", findBy(compare, NETWORK_KEY.linkedin));
    const combinedCompare = combineMetrics([compareGoogle, compareLinkedin]);

    const totalVisits = (primary.totals?.visits ?? 0) || 0;
    const trafficShare = buildTrafficShare(primary.breakdowns ?? [], totalVisits);
    const dailySeries = buildDailySeries(daily, range.from, range.to);

    return {
      source: "live",
      range,
      byNetwork,
      combined,
      combinedCompare,
      daily: dailySeries,
      trafficShare,
    };
  } catch (err) {
    console.error("[marketing/hubspot-analytics] getAdAnalytics failed:", err);
    return { ...PLACEHOLDER, range };
  }
}

const _cachedAdAnalytics = unstable_cache(
  _getAdAnalytics,
  ["hubspot-analytics:getAdAnalytics"],
  { tags: ["hubspot:adAnalytics"], revalidate: 300 },
);

export async function getAdAnalytics(
  range: { from: Date; to: Date },
  compareRange: { from: Date; to: Date },
): Promise<AdAnalyticsSummary> {
  return _cachedAdAnalytics(
    range.from.getTime(),
    range.to.getTime(),
    compareRange.from.getTime(),
    compareRange.to.getTime(),
  );
}
