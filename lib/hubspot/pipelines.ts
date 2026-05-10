/**
 * HubSpot pipeline + stage lookup. The Account Penetration view needs to know
 * which deals are "closed-won" vs. which earlier stage they're in (R&D, Quote,
 * Onboarding, etc.) so the thermometer can pick the right intensity.
 *
 * Stages are normalized into a small set of buckets the UI knows how to color.
 * Map your real HubSpot stage IDs into these buckets in `STAGE_BUCKET_MAP`
 * once the pipelines are finalized.
 */

import { hubspotFetch, hasHubspotCreds, getHubspotEnv } from "./client";

/**
 * Coarse buckets the thermometer renders. Ordered earliest → latest so the
 * UI can compute "intensity" from the index. Closed-won is the only fully
 * saturated band; earlier stages get progressively lighter.
 */
export const STAGE_BUCKETS = [
  "rnd",
  "quoting",
  "onboarding",
  "closed_won",
] as const;

export type StageBucket = (typeof STAGE_BUCKETS)[number];

export type PipelineStage = {
  id: string;
  label: string;
  bucket: StageBucket;
  /** Probability HubSpot assigns to the stage (0–1). Closed-won = 1. */
  probability: number;
};

export type Pipeline = {
  id: string;
  label: string;
  stages: PipelineStage[];
};

/**
 * Map raw HubSpot stage labels (lowercased) to the coarse bucket the UI uses.
 * Anything not matched falls through to "rnd" (lightest).
 */
const STAGE_BUCKET_MAP: Array<{ match: RegExp; bucket: StageBucket }> = [
  { match: /closed[\s_-]*won|won|approved|production/i, bucket: "closed_won" },
  { match: /onboard|fps|pilot|signed/i, bucket: "onboarding" },
  { match: /quot|proposal|negotiat/i, bucket: "quoting" },
  { match: /r&?d|discovery|formul|sample|develop/i, bucket: "rnd" },
];

export function bucketForStageLabel(label: string): StageBucket {
  for (const entry of STAGE_BUCKET_MAP) {
    if (entry.match.test(label)) return entry.bucket;
  }
  return "rnd";
}

type HubspotPipelineResponse = {
  results: Array<{
    id: string;
    label: string;
    stages: Array<{
      id: string;
      label: string;
      metadata?: { probability?: string; isClosed?: string; closedStageType?: string };
    }>;
  }>;
};

export async function listDealPipelines(): Promise<Pipeline[]> {
  if (!hasHubspotCreds()) return MOCK_PIPELINES;

  const data = await hubspotFetch<HubspotPipelineResponse>(
    "/crm/v3/pipelines/deals",
  );
  return data.results.map(p => ({
    id: p.id,
    label: p.label,
    stages: p.stages.map(s => ({
      id: s.id,
      label: s.label,
      bucket: bucketForStageLabel(s.label),
      probability: Number(s.metadata?.probability ?? 0),
    })),
  }));
}

export async function getSalesAndExpansionPipelines(): Promise<{
  sales: Pipeline | null;
  expansion: Pipeline | null;
}> {
  const env = getHubspotEnv();
  const all = await listDealPipelines();
  if (!env) {
    return {
      sales: all.find(p => p.id === "default") ?? null,
      expansion: all.find(p => p.id === "account-expansion") ?? null,
    };
  }
  return {
    sales: all.find(p => p.id === env.salesPipelineId) ?? null,
    expansion: all.find(p => p.id === env.expansionPipelineId) ?? null,
  };
}

const MOCK_PIPELINES: Pipeline[] = [
  {
    id: "default",
    label: "Sales Pipeline",
    stages: [
      { id: "s-discovery", label: "Discovery", bucket: "rnd", probability: 0.1 },
      { id: "s-quote", label: "Quote Sent", bucket: "quoting", probability: 0.4 },
      { id: "s-negotiate", label: "Negotiation", bucket: "quoting", probability: 0.6 },
      { id: "s-closedwon", label: "Closed Won", bucket: "closed_won", probability: 1 },
    ],
  },
  {
    id: "account-expansion",
    label: "Account Expansion Pipeline",
    stages: [
      { id: "ax-rnd", label: "R&D", bucket: "rnd", probability: 0.15 },
      { id: "ax-quote", label: "Quoting", bucket: "quoting", probability: 0.4 },
      { id: "ax-onboarding", label: "Onboarding / FPS", bucket: "onboarding", probability: 0.7 },
      { id: "ax-closedwon", label: "Closed Won", bucket: "closed_won", probability: 1 },
    ],
  },
];
