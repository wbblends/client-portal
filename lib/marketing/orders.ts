/**
 * Cross-references HubSpot company names (from `getMarketingAttribution`) with
 * the orders portal customer roster to compute "marketing-influenced POs".
 *
 * The orders portal data lives in `lib/data/orders-portal.ts` (currently a
 * static seed; will be backed by Acumatica later). Customer names there don't
 * always match HubSpot company names exactly — we use a two-pass match:
 *
 *   1. Exact match on a normalized form (lowercased, alphanumerics only)
 *   2. Substring containment in either direction (with a 4-char minimum
 *      to avoid false positives like "ER" matching "Bergamot")
 *
 * Unmatched HubSpot companies are returned in the response so Devin can spot
 * the gaps and decide whether to alias them or rename in HubSpot.
 */

import { ORDERS_PORTAL_SEED, type OrdersPortalRow } from "@/lib/data/orders-portal";

export type OrderMatch = {
  ordersCustomer: string;
  hubspotCompany: string;
  ytdPOs: number;
};

export type MarketingInfluencedPOStats = {
  source: "live" | "placeholder";
  matches: OrderMatch[];
  unmatchedHubSpotCompanies: string[];
  ytdInfluencedPOs: number;
  totalYTDPOs: number;
  /** 0–1 ratio of influencedPOs / total YTD POs across all customers. */
  influencedShare: number;
};

const PLACEHOLDER: MarketingInfluencedPOStats = {
  source: "placeholder",
  matches: [
    { ordersCustomer: "Veracity", hubspotCompany: "Veracity Selfcare", ytdPOs: 268_200 },
    { ordersCustomer: "Bioptimizers", hubspotCompany: "Bioptimizers", ytdPOs: 677_845 },
  ],
  unmatchedHubSpotCompanies: [],
  ytdInfluencedPOs: 946_045,
  totalYTDPOs: 23_240_000,
  influencedShare: 946_045 / 23_240_000,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ytdSum(row: OrdersPortalRow): number {
  return row.months.reduce<number>((sum, m) => sum + (m ?? 0), 0);
}

/**
 * Sum the row's monthly POs that overlap [range.from, range.to]. The orders
 * portal seed represents the current calendar year — we walk months 0..11
 * and include any month whose calendar window touches the range.
 */
function rangeSum(row: OrdersPortalRow, range: { from: Date; to: Date }): number {
  const year = new Date().getFullYear();
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1).getTime();
    const monthEnd = new Date(year, m + 1, 0, 23, 59, 59, 999).getTime();
    if (monthEnd >= range.from.getTime() && monthStart <= range.to.getTime()) {
      total += row.months[m] ?? 0;
    }
  }
  return total;
}

export function getMarketingInfluencedPOs(
  touchedHubSpotCompanyNames: string[],
  options: { isPlaceholder?: boolean; range?: { from: Date; to: Date } } = {},
): MarketingInfluencedPOStats {
  if (options.isPlaceholder) return PLACEHOLDER;
  const sumForRow = (row: OrdersPortalRow) =>
    options.range ? rangeSum(row, options.range) : ytdSum(row);

  const ordersByNormName = new Map<string, OrdersPortalRow>();
  for (const row of ORDERS_PORTAL_SEED) {
    ordersByNormName.set(normalize(row.customer), row);
  }
  const allRows = Array.from(ordersByNormName.values());

  const matches: OrderMatch[] = [];
  const matchedRowIds = new Set<string>();
  const unmatched: string[] = [];

  for (const hsName of touchedHubSpotCompanyNames) {
    const hsNorm = normalize(hsName);
    if (hsNorm.length < 3) continue;

    let row = ordersByNormName.get(hsNorm);
    if (!row) {
      row = allRows.find(r => {
        const rNorm = normalize(r.customer);
        if (rNorm.length < 4 || hsNorm.length < 4) return false;
        return rNorm.includes(hsNorm) || hsNorm.includes(rNorm);
      });
    }

    if (row) {
      // Don't double-count if multiple HubSpot aliases match the same customer.
      if (matchedRowIds.has(row.id)) continue;
      matchedRowIds.add(row.id);
      matches.push({
        ordersCustomer: row.customer,
        hubspotCompany: hsName,
        ytdPOs: sumForRow(row),
      });
    } else {
      unmatched.push(hsName);
    }
  }

  const ytdInfluencedPOs = matches.reduce((s, m) => s + m.ytdPOs, 0);
  const totalYTDPOs = ORDERS_PORTAL_SEED.reduce((s, r) => s + sumForRow(r), 0);

  return {
    source: "live",
    matches: matches.sort((a, b) => b.ytdPOs - a.ytdPOs),
    unmatchedHubSpotCompanies: unmatched.slice(0, 30),
    ytdInfluencedPOs,
    totalYTDPOs,
    influencedShare: totalYTDPOs > 0 ? ytdInfluencedPOs / totalYTDPOs : 0,
  };
}
