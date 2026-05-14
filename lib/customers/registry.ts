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
import { TICKET_CUSTOMER_LOGO_DOMAINS } from "./ticket-logo-domains";

export type Customer = {
  id: string;
  name: string;
  canonicalName?: string;
  /**
   * Website domain, no protocol (e.g. "thorne.com"). Powers the company logo
   * rendered on the admin Tickets board via the favicon service — see
   * `customerDomainFor`. Best-effort: several entries below are educated
   * guesses and should be verified. Leave unset rather than guess wildly,
   * since a wrong domain renders a misleading favicon.
   */
  domain?: string;
  /**
   * Alternate spellings of this customer as they appear in upstream systems —
   * especially the free-text `customer` column of the PM ticket spreadsheet,
   * which rarely matches the registry spelling. Matched the same way as
   * `name`/`canonicalName`: case- and punctuation-insensitive. Only genuinely
   * different wordings need an entry. These are best-guess and worth a check.
   */
  aliases?: readonly string[];
};

export const CUSTOMERS: readonly Customer[] = [
  { id: "kilo-health", name: "Kilo Health", canonicalName: "Kilo Health", domain: "kilohealth.com", aliases: ["UAB ER Solutions (Kilo Health)", "UAB Bioma Health (Kilo Health)"] },
  { id: "designs-for-health", name: "Designs for Health", canonicalName: "Designs For Health", domain: "designsforhealth.com" },
  { id: "golden-hippo", name: "Golden Hippo", canonicalName: "Golden Hippo", domain: "goldenhippo.com" },
  { id: "native-path", name: "Native Path", canonicalName: "Native Path", domain: "nativepath.com", aliases: ["NativePath"] },
  { id: "silver-fern", name: "Silver Fern", canonicalName: "Silver Fern", domain: "silverfernbrand.com" },
  { id: "just-ingredients", name: "Just Ingredients", canonicalName: "Just Ingredients", domain: "justingredients.us" },
  { id: "bioptimizer", name: "BiOptimizer", canonicalName: "Bioptimizers", domain: "bioptimizers.com", aliases: ["BIOptimizers USA Inc."] },
  { id: "clean-nutraceuticals", name: "Clean Nutraceuticals", canonicalName: "Clean Nutraceuticals", domain: "cleannutraceuticals.com", aliases: ["Clean Nutra"] },
  { id: "veracity", name: "Veracity", canonicalName: "Veracity Selfcare", domain: "veracityselfcare.com" },
  { id: "thorne", name: "Thorne", canonicalName: "Thorne", domain: "thorne.com" },
  { id: "sports-research", name: "Sports Research", canonicalName: "Sports Research", domain: "sportsresearch.com" },
  { id: "snap", name: "SNAP", canonicalName: "SNAP", domain: "snapsupplements.com", aliases: ["SNAP Supplements"] },
] as const;

/** Resolves the canonical name for a customer, falling back to `name`. */
export function canonicalNameOf(customer: Customer): string {
  return customer.canonicalName ?? customer.name;
}

// Case- and punctuation-insensitive: drops everything that isn't a letter or
// digit so "Native Path", "NativePath", and "native-path" all collapse to the
// same key. Deliberately blunt — the PM spreadsheet's customer column is free
// text, so exact/whitespace matching misses too much.
function normalizeCustomerName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Pre-normalized index of the non-portal-customer logo domains, built once at
// module load so per-row lookups on the Tickets board stay cheap.
const NORMALIZED_TICKET_DOMAINS = new Map<string, string>(
  Object.entries(TICKET_CUSTOMER_LOGO_DOMAINS).map(([brand, domain]) => [
    normalizeCustomerName(brand),
    domain,
  ]),
);

/**
 * Best-effort resolution of a free-text customer name to a website domain for
 * logo rendering. The PM ticket spreadsheet sends customer names that rarely
 * match the registry spelling, so this checks the portal customer registry
 * first (matching `name`, `canonicalName`, and `aliases`), then falls back to
 * the supplementary map of non-portal brands that still appear in tickets.
 * Returns null when the name resolves to neither — callers should fall back to
 * a placeholder.
 */
export function customerDomainFor(name: string): string | null {
  const n = normalizeCustomerName(name ?? "");
  if (!n) return null;
  for (const c of CUSTOMERS) {
    const candidates = [c.name, canonicalNameOf(c), ...(c.aliases ?? [])];
    if (candidates.some(v => normalizeCustomerName(v) === n)) {
      return c.domain ?? null;
    }
  }
  return NORMALIZED_TICKET_DOMAINS.get(n) ?? null;
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
 *  - "admin", "super_admin", and "internal" may access any customer in the registry.
 *
 * Returns null when access is denied or the id isn't in the registry.
 */
export function customerForUser(
  user: {
    role: "super_admin" | "admin" | "internal" | "customer";
    customerIds: string[];
  },
  id: string,
): Customer | null {
  const c = getCustomer(id);
  if (!c) return null;
  if (user.role === "customer") {
    return user.customerIds.includes(id) ? c : null;
  }
  return c;
}

/**
 * Returns the user's effective permission for a customer they already have
 * access to. Admin (super or regular) and internal roles are always editors;
 * customer-role users fall back to whatever was stored in
 * user_customers.permission, defaulting to 'viewer' if missing.
 *
 * Callers should resolve access via `customerForUser` first — this function
 * only answers "what tier" once "can they see it at all" is established.
 */
export function customerPermissionFor(
  user: {
    role: "super_admin" | "admin" | "internal" | "customer";
    customerPermissions: Record<string, "viewer" | "editor">;
  },
  customerId: string,
): "viewer" | "editor" {
  if (user.role !== "customer") return "editor";
  return user.customerPermissions[customerId] ?? "viewer";
}
