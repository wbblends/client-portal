/**
 * HubSpot company lookup. Companies are joined to deals via the deal-to-company
 * association so the Account Penetration view can show one row per account.
 */

import { hubspotFetch, hasHubspotCreds } from "./client";

export type Company = {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
};

type HubspotCompanyBatchResponse = {
  results: Array<{
    id: string;
    properties: Record<string, string | null>;
  }>;
};

export async function getCompaniesByIds(ids: string[]): Promise<Map<string, Company>> {
  const out = new Map<string, Company>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;

  if (!hasHubspotCreds()) {
    for (const id of unique) {
      const mock = MOCK_COMPANIES[id];
      if (mock) out.set(id, mock);
    }
    return out;
  }

  const data = await hubspotFetch<HubspotCompanyBatchResponse>(
    "/crm/v3/objects/companies/batch/read",
    {
      method: "POST",
      body: JSON.stringify({
        properties: ["name", "domain", "industry"],
        inputs: unique.map(id => ({ id })),
      }),
    },
  );

  for (const c of data.results) {
    out.set(c.id, {
      id: c.id,
      name: c.properties.name ?? "Unnamed account",
      domain: c.properties.domain ?? undefined,
      industry: c.properties.industry ?? undefined,
    });
  }
  return out;
}

const MOCK_COMPANIES: Record<string, Company> = {
  "co-cn": { id: "co-cn", name: "Clean Nutra", domain: "cleannutra.example", industry: "Wellness" },
  "co-sr": { id: "co-sr", name: "Sports Research", domain: "sportsresearch.example", industry: "Sports Nutrition" },
  "co-vh": { id: "co-vh", name: "Verdant Health", domain: "verdanthealth.example", industry: "Wellness" },
  "co-pf": { id: "co-pf", name: "Pure Form Labs", domain: "pureformlabs.example", industry: "Sports Nutrition" },
};
