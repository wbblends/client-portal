import { notFound } from "next/navigation";
import { hashString, seededRng } from "@/lib/utils";
import { getCustomer } from "@/lib/customers/registry";
import type { CustomerProfile } from "./types";

/**
 * Returns the customer profile for a given customer id. Mock implementation —
 * future: hit Acumatica `Customer` GET endpoint and the proprietary CRM for
 * supplemental fields.
 *
 * Unknown ids trigger `notFound()` so a stale or stray id surfaces as a 404
 * rather than a half-rendered page with the raw id as the display name.
 * Routes under `/c/[customerId]/...` already gate on `requireCustomerAccess`,
 * so in practice only direct callers (or future broken links into this loader)
 * would hit this branch.
 */
export async function getCustomerProfile(customerId: string): Promise<CustomerProfile> {
  const known = getCustomer(customerId);
  if (!known) notFound();
  const rng = seededRng(hashString(customerId));
  return {
    id: customerId,
    name: known.name,
    primaryContact: "TBD",
    accountSince: 2018 + Math.floor(rng() * 5),
  };
}
