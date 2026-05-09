/**
 * Single source of truth for the customers the portal knows about.
 * Each customer's pages live under `/c/<id>/...` (overview, documents,
 * invoices, quality, contact).
 *
 * To add a customer, add an entry below. Future: replace with a query
 * against Acumatica or the proprietary system.
 *
 * **Three names per customer, by design:**
 *  - `id`            URL segment + permission key. Lowercase, hyphenated.
 *                    Stable forever; never reuse a retired id.
 *  - `name`          Display string for the UI.
 *  - `canonicalName` The form Acumatica/HubSpot/the orders portal will return.
 *                    Lets cross-system joins (marketing attribution, ERP
 *                    pulls, the orders portal seed in `lib/data/orders-portal.ts`)
 *                    resolve unambiguously without fuzzy string matching.
 *                    Defaults to `name` when unset.
 */
export type Customer = {
  id: string;
  name: string;
  canonicalName?: string;
};

export const CUSTOMERS: readonly Customer[] = [
  { id: "kilo-health", name: "Kilo Health", canonicalName: "Kilo Health" },
  { id: "designs-for-health", name: "Designs for Health", canonicalName: "Designs For Health" },
  { id: "golden-hippo", name: "Golden Hippo", canonicalName: "Golden Hippo" },
  { id: "native-path", name: "Native Path", canonicalName: "Native Path" },
  { id: "silver-fern", name: "Silver Fern", canonicalName: "Silver Fern" },
  { id: "just-ingredients", name: "Just Ingredients", canonicalName: "Just Ingredients" },
  { id: "bioptimizer", name: "BiOptimizer", canonicalName: "Bioptimizers" },
  { id: "clean-nutraceuticals", name: "Clean Nutraceuticals", canonicalName: "Clean Nutraceuticals" },
  { id: "veracity", name: "Veracity", canonicalName: "Veracity Selfcare" },
  { id: "thorne", name: "Thorne", canonicalName: "Thorne" },
  { id: "sports-research", name: "Sports Research", canonicalName: "Sports Research" },
  { id: "snap", name: "SNAP", canonicalName: "SNAP" },
] as const;

/** Resolves the canonical name for a customer, falling back to `name`. */
export function canonicalNameOf(customer: Customer): string {
  return customer.canonicalName ?? customer.name;
}

export function listCustomers(): readonly Customer[] {
  return CUSTOMERS;
}

export function getCustomer(id: string): Customer | null {
  return CUSTOMERS.find(c => c.id === id) ?? null;
}

/**
 * Returns the customer the user is allowed to see at this id.
 *  - "customer" role users may only access their own customerId.
 *  - "admin" and "internal" role users may access any customer in the registry.
 *
 * Returns null when access is denied or the id isn't in the registry.
 */
export function customerForUser(
  user: { role: "admin" | "internal" | "customer"; customerIds: string[] },
  id: string,
): Customer | null {
  const c = getCustomer(id);
  if (!c) return null;
  if (user.role === "customer") {
    return user.customerIds.includes(id) ? c : null;
  }
  return c;
}
