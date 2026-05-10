/**
 * HubSpot API client stub.
 *
 * `hubspotFetch` is the single entry point for any HubSpot HTTPS call. Until
 * `HUBSPOT_PRIVATE_APP_TOKEN` is set, no requests are made — callers that need
 * data should use `hasHubspotCreds()` to decide whether to fall back to the
 * mock fixtures in `./fixtures.ts`.
 *
 * To wire up real HubSpot:
 *   1. Create a HubSpot Private App with scopes: crm.objects.deals.read,
 *      crm.objects.companies.read, crm.schemas.deals.read.
 *   2. Set HUBSPOT_PRIVATE_APP_TOKEN in Vercel project env vars.
 *   3. Set HUBSPOT_SALES_PIPELINE_ID and HUBSPOT_EXPANSION_PIPELINE_ID to the
 *      two pipeline IDs the loader uses (see lib/hubspot/pipelines.ts).
 *   4. Set HUBSPOT_EXPECTED_ANNUAL_VALUE_PROPERTY to the deal property that
 *      stores the projected annual value at account-close time
 *      (defaults to "expected_annual_value").
 */

const HUBSPOT_BASE = "https://api.hubapi.com";

export type HubspotEnv = {
  token: string;
  salesPipelineId: string;
  expansionPipelineId: string;
  expectedAnnualValueProperty: string;
};

export function getHubspotEnv(): HubspotEnv | null {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return null;
  return {
    token,
    salesPipelineId: process.env.HUBSPOT_SALES_PIPELINE_ID ?? "default",
    expansionPipelineId:
      process.env.HUBSPOT_EXPANSION_PIPELINE_ID ?? "account-expansion",
    expectedAnnualValueProperty:
      process.env.HUBSPOT_EXPECTED_ANNUAL_VALUE_PROPERTY ??
      "expected_annual_value",
  };
}

export function hasHubspotCreds(): boolean {
  return getHubspotEnv() !== null;
}

export class HubspotError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "HubspotError";
  }
}

export async function hubspotFetch<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const env = getHubspotEnv();
  if (!env) {
    throw new HubspotError(
      "HUBSPOT_PRIVATE_APP_TOKEN is not configured. Loader should fall back to fixtures via hasHubspotCreds().",
      0,
      null,
    );
  }

  const { searchParams, headers, ...rest } = init;
  const url = new URL(path.startsWith("http") ? path : `${HUBSPOT_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
      ...headers,
    },
    // Routine sync: cache for 5 minutes at the data-layer level. Pages that
    // need fresher data can revalidate via the route segment.
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HubspotError(
      `HubSpot ${rest.method ?? "GET"} ${path} failed: ${res.status}`,
      res.status,
      body,
    );
  }

  return res.json() as Promise<T>;
}
