/**
 * Cache tier configuration for the portal's data layer.
 *
 * The premise: the upstream ERP and project systems are slow, so the portal
 * must never hit them in the request path. Every read goes through a tier here
 * that decides how long the response can be served from the in-process cache
 * before being refreshed against the source of truth.
 *
 * Tiers describe how stale the data is allowed to be. Resources map to tiers.
 *
 * | Tier     | Refresh interval     | Examples                                  |
 * | -------- | -------------------- | ----------------------------------------- |
 * | `static` | 1 day                | dropdowns, role lists, brand assets       |
 * | `slow`   | 15 minutes           | customer profile, products, contacts      |
 * | `active` | 60 seconds           | orders, invoices, dashboard KPIs          |
 * | `live`   | uncached             | chat, notifications (use websockets/SSE)  |
 *
 * Manual refresh always uses stale-while-revalidate (`revalidateTag(tag, "max")`),
 * so the user sees the previous data instantly while fresh data loads behind it.
 */

export type Tier = "static" | "slow" | "active" | "live";

export const TIER_REVALIDATE_SECONDS: Record<Tier, number> = {
  static: 60 * 60 * 24,
  slow: 60 * 15,
  active: 60,
  live: 0,
};

/**
 * Registry of every cacheable resource the portal exposes. Adding a new ERP
 * read? Add the resource here so the refresh button + sync layer pick it up.
 */
export const RESOURCES = {
  "customer-profile": { tier: "slow" },
  orders: { tier: "active" },
  "open-orders": { tier: "active" },
  invoices: { tier: "active" },
  onboarding: { tier: "slow" },
  contacts: { tier: "slow" },
  documents: { tier: "slow" },
  quality: { tier: "slow" },
  "sales-products": { tier: "active" },
} as const satisfies Record<string, { tier: Tier }>;

export type ResourceName = keyof typeof RESOURCES;

export function tierFor(resource: ResourceName): Tier {
  return RESOURCES[resource].tier;
}

/**
 * Cache tag for a resource, optionally scoped (typically by customer id).
 * Scoping means refreshing one customer's orders does not invalidate another's.
 */
export function tagFor(resource: ResourceName, scope?: string): string {
  return scope ? `${resource}:${scope}` : resource;
}
