/**
 * Pipeline history data layer.
 *
 * HubSpot doesn't expose historical pipeline snapshots, so we reconstruct
 * "what was open at the end of week X" by pulling every deal (open + closed)
 * across both marketing pipelines and replaying their lifecycle:
 *
 *   open at week-end W   ⟺  createdate ≤ W AND (still open today OR closedate > W)
 *   added during week    ⟺  createdate ∈ [weekStart, weekEnd]
 *   closed during week   ⟺  isClosed AND closedate ∈ [weekStart, weekEnd]
 *
 * Two caveats worth knowing:
 *   1. We use today's `amount` for every historical bucket — if a deal's
 *      amount was edited mid-flight, history won't reflect the older value.
 *   2. We only have the *current* close-won/lost status. A deal that flipped
 *      stages multiple times will be counted once, on its final close date.
 */

import { PIPELINES } from "./hubspot";
import { buildBuckets, pickBucketing, type Bucket } from "@/lib/data/aggregate";

const HUBSPOT_API = "https://api.hubapi.com";

// Re-uses the searchFetch throttle from hubspot.ts via the same module-level
// queue — Node module caching means importing PIPELINES from there pulls in
// the throttle state. To keep this file self-contained without a circular
// import we duplicate the throttle pattern. Both queues serializing into the
// same HubSpot account is still the right thing — they share rate budget.
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
    let res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 1);
      const waitMs = Math.max(1000, retryAfter * 1000);
      await new Promise(r => setTimeout(r, waitMs));
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    }
    return res;
  } finally {
    setTimeout(release, SEARCH_GAP_MS);
  }
}

type DealRecord = {
  id: string;
  amount: number;
  weighted: number;
  /** ms since epoch — when the deal was created in HubSpot. */
  createdate: number;
  /** ms since epoch — only meaningful when isClosed = true. */
  closedate: number | null;
  isClosed: boolean;
  isWon: boolean;
};

export type PipelineHistoryBucket = {
  label: string;
  /** ISO start of bucket — useful as a chart key. */
  key: string;
  // Snapshot at bucket end:
  openCount: number;
  openUnweighted: number;
  openWeighted: number;
  // Flow during bucket:
  addedCount: number;
  addedAmount: number;
  closedWonCount: number;
  closedWonAmount: number;
  closedLostCount: number;
  closedLostAmount: number;
};

export type PipelineHistory = {
  source: "live" | "placeholder";
  bucketing: "week" | "month";
  buckets: PipelineHistoryBucket[];
};

const PLACEHOLDER_HISTORY: PipelineHistory = {
  source: "placeholder",
  bucketing: "month",
  buckets: ["Jan", "Feb", "Mar", "Apr", "May"].map((label, i) => ({
    label,
    key: `placeholder-${i}`,
    openCount: 120 + i * 12,
    openUnweighted: 80_000_000 + i * 9_000_000,
    openWeighted: 45_000_000 + i * 5_000_000,
    addedCount: 18 + i * 2,
    addedAmount: 9_500_000 + i * 1_200_000,
    closedWonCount: 4 + i,
    closedWonAmount: 1_800_000 + i * 350_000,
    closedLostCount: 6,
    closedLostAmount: 1_200_000 + i * 200_000,
  })),
};

function token(): string | null {
  return process.env.HUBSPOT_PRIVATE_APP_TOKEN ?? null;
}

async function fetchAllDealsForHistory(): Promise<DealRecord[]> {
  const t = token();
  if (!t) throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");
  const out: DealRecord[] = [];

  for (const pipelineId of [PIPELINES.sales.id, PIPELINES.expansion.id]) {
    let after: string | undefined;
    do {
      const body = {
        filterGroups: [
          { filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }] },
        ],
        properties: [
          "amount",
          "hs_projected_amount",
          "createdate",
          "closedate",
          "hs_is_closed",
          "hs_is_closed_won",
        ],
        sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
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
        throw new Error(`HubSpot deals history search failed: ${res.status} ${await res.text()}`);
      }
      const data = (await res.json()) as {
        results: { id: string; properties: Record<string, string | null> }[];
        paging?: { next?: { after: string } };
      };
      for (const r of data.results) {
        const amount = Number(r.properties.amount ?? 0);
        const weighted = Number(r.properties.hs_projected_amount ?? 0);
        const createdateRaw = r.properties.createdate;
        if (!createdateRaw) continue;
        const createdate = Date.parse(createdateRaw);
        if (!Number.isFinite(createdate)) continue;
        const isClosed = r.properties.hs_is_closed === "true";
        const isWon = r.properties.hs_is_closed_won === "true";
        const closedateRaw = r.properties.closedate;
        const closedate =
          isClosed && closedateRaw ? (() => {
            const ms = Date.parse(closedateRaw);
            return Number.isFinite(ms) ? ms : null;
          })() : null;
        out.push({
          id: r.id,
          amount: Number.isFinite(amount) ? amount : 0,
          weighted: Number.isFinite(weighted) ? weighted : 0,
          createdate,
          closedate,
          isClosed,
          isWon,
        });
      }
      after = data.paging?.next?.after;
    } while (after);
  }

  return out;
}

function bucketDeals(buckets: Bucket[], deals: DealRecord[]): PipelineHistoryBucket[] {
  return buckets.map(b => {
    const start = b.start.getTime();
    const end = b.end.getTime();
    let openCount = 0;
    let openUnweighted = 0;
    let openWeighted = 0;
    let addedCount = 0;
    let addedAmount = 0;
    let closedWonCount = 0;
    let closedWonAmount = 0;
    let closedLostCount = 0;
    let closedLostAmount = 0;

    for (const d of deals) {
      // Was this deal open at the end of this bucket?
      const openAtEnd =
        d.createdate <= end && (!d.isClosed || (d.closedate !== null && d.closedate > end));
      if (openAtEnd) {
        openCount++;
        openUnweighted += d.amount;
        openWeighted += d.weighted;
      }
      // Was it created during this bucket?
      if (d.createdate >= start && d.createdate <= end) {
        addedCount++;
        addedAmount += d.amount;
      }
      // Was it closed during this bucket?
      if (d.isClosed && d.closedate !== null && d.closedate >= start && d.closedate <= end) {
        if (d.isWon) {
          closedWonCount++;
          closedWonAmount += d.amount;
        } else {
          closedLostCount++;
          closedLostAmount += d.amount;
        }
      }
    }

    return {
      label: b.label,
      key: b.key,
      openCount,
      openUnweighted,
      openWeighted,
      addedCount,
      addedAmount,
      closedWonCount,
      closedWonAmount,
      closedLostCount,
      closedLostAmount,
    };
  });
}

export async function getPipelineHistory(range: {
  from: Date;
  to: Date;
}): Promise<PipelineHistory> {
  if (!token()) return PLACEHOLDER_HISTORY;
  try {
    const deals = await fetchAllDealsForHistory();
    const bucketing = pickBucketing(range.from, range.to);
    const buckets = buildBuckets(range.from, range.to, bucketing);
    return {
      source: "live",
      bucketing,
      buckets: bucketDeals(buckets, deals),
    };
  } catch (err) {
    console.error("[marketing/pipeline-history] getPipelineHistory failed:", err);
    return PLACEHOLDER_HISTORY;
  }
}
