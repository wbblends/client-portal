import { seededRng } from "@/lib/utils";
import { cached } from "@/lib/cache/cached";
import type { CustomerProfile } from "./types";

/**
 * Returns the customer profile for a given customer id. Mock implementation —
 * future: hit Acumatica `Customer` GET endpoint and the proprietary CRM for
 * supplemental fields.
 *
 * Wrapped in `cached()` at the `slow` tier so subsequent renders skip the
 * upstream call. Manual refresh via `<RefreshButton resources="customer-profile" />`.
 */
async function fetchCustomerProfile(customerId: string): Promise<CustomerProfile> {
  const rng = seededRng(hash(customerId));
  return {
    id: customerId,
    name: customerNames[customerId] ?? "Devin's Test Brand",
    primaryContact: "Devin Simmons",
    accountSince: 2018 + Math.floor(rng() * 5),
  };
}

export const getCustomerProfile = cached(fetchCustomerProfile, {
  resource: "customer-profile",
  scope: (customerId) => customerId,
});

const customerNames: Record<string, string> = {
  "C-1042": "Devin's Test Brand",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
