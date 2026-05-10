/**
 * HubSpot deals search. Used to find:
 *   - Closed-won deals on the main sales pipeline (these are "the account
 *     was won at $X expected annual value" — that's the thermometer width).
 *   - All deals on the account-expansion pipeline (closed-won fills the
 *     thermometer; in-flight deals show as lighter bands).
 *
 * Deals carry an `expected_annual_value` property (configurable via env) which
 * is the projected annual run-rate at the time the account was first closed.
 * If absent, we fall back to the deal `amount` so the thermometer still has a
 * width to render.
 */

import { hubspotFetch, hasHubspotCreds, getHubspotEnv } from "./client";

export type Deal = {
  id: string;
  name: string;
  amount: number;
  expectedAnnualValue: number;
  stageId: string;
  pipelineId: string;
  closedDate: Date | null;
  companyId: string | null;
  /** SKU label if this is an account-expansion deal tied to a specific product. */
  sku?: string;
};

type HubspotDealSearchResponse = {
  results: Array<{
    id: string;
    properties: Record<string, string | null>;
    associations?: {
      companies?: { results: Array<{ id: string }> };
    };
  }>;
};

async function searchDealsByPipeline(pipelineId: string): Promise<Deal[]> {
  const env = getHubspotEnv();
  const valueProp = env?.expectedAnnualValueProperty ?? "expected_annual_value";

  const body = {
    filterGroups: [
      {
        filters: [{ propertyName: "pipeline", operator: "EQ", value: pipelineId }],
      },
    ],
    properties: [
      "dealname",
      "amount",
      "dealstage",
      "pipeline",
      "closedate",
      "sku",
      valueProp,
    ],
    limit: 100,
  };

  const data = await hubspotFetch<HubspotDealSearchResponse>(
    "/crm/v3/objects/deals/search",
    {
      method: "POST",
      body: JSON.stringify(body),
      searchParams: { associations: "companies" },
    },
  );

  return data.results.map(d => {
    const amount = Number(d.properties.amount ?? 0);
    const expected = Number(d.properties[valueProp] ?? 0) || amount;
    const closeRaw = d.properties.closedate;
    return {
      id: d.id,
      name: d.properties.dealname ?? "Untitled deal",
      amount,
      expectedAnnualValue: expected,
      stageId: d.properties.dealstage ?? "",
      pipelineId: d.properties.pipeline ?? pipelineId,
      closedDate: closeRaw ? new Date(closeRaw) : null,
      companyId: d.associations?.companies?.results?.[0]?.id ?? null,
      sku: d.properties.sku ?? undefined,
    };
  });
}

export async function getSalesPipelineClosedWon(): Promise<Deal[]> {
  if (!hasHubspotCreds()) {
    return MOCK_SALES_CLOSED_WON;
  }
  const env = getHubspotEnv();
  const all = await searchDealsByPipeline(env!.salesPipelineId);
  return all.filter(d => d.closedDate !== null);
}

export async function getExpansionDeals(): Promise<Deal[]> {
  if (!hasHubspotCreds()) {
    return MOCK_EXPANSION_DEALS;
  }
  const env = getHubspotEnv();
  return searchDealsByPipeline(env!.expansionPipelineId);
}

// ---------------------------------------------------------------------------
// Mock fixtures — used when HUBSPOT_PRIVATE_APP_TOKEN is unset. Mirrors the
// shape the real API returns so the loader code is the same in both modes.
// ---------------------------------------------------------------------------

const MOCK_SALES_CLOSED_WON: Deal[] = [
  {
    id: "deal-cn",
    name: "Clean Nutra — Master Supply Agreement",
    amount: 5_000_000,
    expectedAnnualValue: 5_000_000,
    stageId: "s-closedwon",
    pipelineId: "default",
    closedDate: new Date("2025-11-12"),
    companyId: "co-cn",
  },
  {
    id: "deal-sr",
    name: "Sports Research — Master Supply Agreement",
    amount: 2_000_000,
    expectedAnnualValue: 2_000_000,
    stageId: "s-closedwon",
    pipelineId: "default",
    closedDate: new Date("2025-08-20"),
    companyId: "co-sr",
  },
  {
    id: "deal-vh",
    name: "Verdant Health — Master Supply Agreement",
    amount: 3_500_000,
    expectedAnnualValue: 3_500_000,
    stageId: "s-closedwon",
    pipelineId: "default",
    closedDate: new Date("2026-02-04"),
    companyId: "co-vh",
  },
  {
    id: "deal-pf",
    name: "Pure Form Labs — Master Supply Agreement",
    amount: 1_200_000,
    expectedAnnualValue: 1_200_000,
    stageId: "s-closedwon",
    pipelineId: "default",
    closedDate: new Date("2026-03-18"),
    companyId: "co-pf",
  },
];

const MOCK_EXPANSION_DEALS: Deal[] = [
  // Clean Nutra — $5M expected; ~$2.4M filled, $1.6M in flight, ~$1M white space.
  {
    id: "ax-cn-1",
    name: "Magnesium Glycinate — 120 ct",
    amount: 1_400_000,
    expectedAnnualValue: 1_400_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2026-01-10"),
    companyId: "co-cn",
    sku: "CN-CAP-101",
  },
  {
    id: "ax-cn-2",
    name: "Greens Powder — 30 srv",
    amount: 1_000_000,
    expectedAnnualValue: 1_000_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2026-02-22"),
    companyId: "co-cn",
    sku: "CN-PWD-204",
  },
  {
    id: "ax-cn-3",
    name: "Sleep Tincture — 2 oz",
    amount: 800_000,
    expectedAnnualValue: 800_000,
    stageId: "ax-onboarding",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-cn",
    sku: "CN-LIQ-310",
  },
  {
    id: "ax-cn-4",
    name: "Cognitive Edge — 90 ct",
    amount: 500_000,
    expectedAnnualValue: 500_000,
    stageId: "ax-quote",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-cn",
    sku: "CN-CAP-405",
  },
  {
    id: "ax-cn-5",
    name: "Adaptogen Stack — 60 ct",
    amount: 300_000,
    expectedAnnualValue: 300_000,
    stageId: "ax-rnd",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-cn",
    sku: "CN-CAP-512",
  },

  // Sports Research — $2M; bigger share already shipping.
  {
    id: "ax-sr-1",
    name: "Whey Isolate — 5 lb tub",
    amount: 900_000,
    expectedAnnualValue: 900_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2025-10-04"),
    companyId: "co-sr",
    sku: "SR-PWD-014",
  },
  {
    id: "ax-sr-2",
    name: "Creatine Monohydrate — 1 kg",
    amount: 450_000,
    expectedAnnualValue: 450_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2026-01-22"),
    companyId: "co-sr",
    sku: "SR-PWD-022",
  },
  {
    id: "ax-sr-3",
    name: "Pre-Workout V2 — 30 srv",
    amount: 350_000,
    expectedAnnualValue: 350_000,
    stageId: "ax-onboarding",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-sr",
    sku: "SR-PWD-038",
  },
  {
    id: "ax-sr-4",
    name: "Joint Support — 90 ct",
    amount: 150_000,
    expectedAnnualValue: 150_000,
    stageId: "ax-rnd",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-sr",
    sku: "SR-CAP-061",
  },

  // Verdant Health — $3.5M; mostly in flight, smaller closed share.
  {
    id: "ax-vh-1",
    name: "Daily Multi — 60 ct",
    amount: 600_000,
    expectedAnnualValue: 600_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2026-03-01"),
    companyId: "co-vh",
    sku: "VH-CAP-001",
  },
  {
    id: "ax-vh-2",
    name: "Beauty Collagen — 30 srv",
    amount: 700_000,
    expectedAnnualValue: 700_000,
    stageId: "ax-onboarding",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-vh",
    sku: "VH-PWD-014",
  },
  {
    id: "ax-vh-3",
    name: "Probiotic 50B — 30 ct",
    amount: 550_000,
    expectedAnnualValue: 550_000,
    stageId: "ax-quote",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-vh",
    sku: "VH-CAP-022",
  },
  {
    id: "ax-vh-4",
    name: "Liver Cleanse — 60 ct",
    amount: 400_000,
    expectedAnnualValue: 400_000,
    stageId: "ax-rnd",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-vh",
    sku: "VH-CAP-030",
  },

  // Pure Form Labs — $1.2M; just one closed expansion so far.
  {
    id: "ax-pf-1",
    name: "Electrolyte Sticks — 20 ct",
    amount: 250_000,
    expectedAnnualValue: 250_000,
    stageId: "ax-closedwon",
    pipelineId: "account-expansion",
    closedDate: new Date("2026-04-02"),
    companyId: "co-pf",
    sku: "PF-STK-001",
  },
  {
    id: "ax-pf-2",
    name: "BCAA Powder — 30 srv",
    amount: 200_000,
    expectedAnnualValue: 200_000,
    stageId: "ax-quote",
    pipelineId: "account-expansion",
    closedDate: null,
    companyId: "co-pf",
    sku: "PF-PWD-008",
  },
];
