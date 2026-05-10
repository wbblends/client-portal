import type { Company } from "./types";

/**
 * Company directory. Today this is a hand-curated mock keyed by the customer
 * IDs that exist in `lib/auth.ts`'s seeded users — once Acumatica + the
 * proprietary CRM are wired up, this loader will fan out to:
 *   - Acumatica `Customer` GET (id, name, terms, lifetime value rollup, addresses)
 *   - Proprietary CRM (segment, AM, sales rep, brand list, notes)
 * and return the merged Company shape unchanged.
 *
 * `externalIds` carries the source-system pointers so any record clicked in
 * the portal can be reconciled back to the system that owns it.
 */

const COMPANIES: Company[] = [
  {
    id: "C-1042",
    name: "Devin's Test Brand",
    primaryContact: "Devin Simmons",
    accountSince: 2020,
    segment: "midmarket",
    status: "active",
    primaryEmail: "devin@devinstest.example",
    primaryPhone: "+1 (555) 333-1042",
    websiteUrl: "https://devinstestbrand.example",
    accountManager: "Jordan Reyes",
    salesRep: "Priya Patel",
    parentCompanyId: null,
    brands: ["Devin's Daily", "Devin's Reset", "Daily Greens Boost"],
    addresses: [
      {
        label: "Headquarters",
        line1: "120 Maple Ave",
        city: "Boulder",
        region: "CO",
        postalCode: "80302",
        country: "US",
      },
      {
        label: "Ship-to: Reno DC",
        line1: "5500 Industrial Way",
        city: "Reno",
        region: "NV",
        postalCode: "89506",
        country: "US",
      },
    ],
    externalIds: {
      acumaticaId: "ACU-CUST-22183",
      proprietarySystemId: "WB-CMS-9912",
    },
    creditTerms: "Net 30",
    lifetimeValue: 4_280_000,
    notes:
      "Prefers consolidated weekly Friday status. Compliance contact looped in on COA distribution.",
  },
  {
    id: "C-1098",
    name: "Northbridge Naturals",
    primaryContact: "Rachel Okafor",
    accountSince: 2022,
    segment: "small",
    status: "active",
    primaryEmail: "ops@northbridgenaturals.example",
    primaryPhone: "+1 (555) 408-2210",
    accountManager: "Jordan Reyes",
    salesRep: "Priya Patel",
    parentCompanyId: null,
    brands: ["Northbridge", "NB Sport"],
    addresses: [
      {
        label: "Headquarters",
        line1: "88 Cascade Pkwy",
        city: "Portland",
        region: "OR",
        postalCode: "97209",
        country: "US",
      },
    ],
    externalIds: {
      acumaticaId: "ACU-CUST-22518",
      proprietarySystemId: "WB-CMS-10044",
    },
    creditTerms: "Net 30",
    lifetimeValue: 1_120_000,
    notes: "Seasonal launch cadence — Q3 ramp every year.",
  },
  {
    id: "C-1156",
    name: "Heliospec Wellness",
    primaryContact: "Marco Silva",
    accountSince: 2019,
    segment: "enterprise",
    status: "active",
    primaryEmail: "supplychain@heliospec.example",
    primaryPhone: "+1 (555) 922-1100",
    accountManager: "Sam Whitlock",
    salesRep: "Priya Patel",
    parentCompanyId: null,
    brands: ["Heliospec", "HS Daily Defense", "Helio Kids"],
    addresses: [
      {
        label: "Headquarters",
        line1: "1400 Innovation Dr",
        city: "Austin",
        region: "TX",
        postalCode: "78758",
        country: "US",
      },
      {
        label: "Ship-to: Memphis 3PL",
        line1: "9000 Distribution Blvd",
        city: "Memphis",
        region: "TN",
        postalCode: "38118",
        country: "US",
      },
      {
        label: "Ship-to: Reno DC",
        line1: "5500 Industrial Way",
        city: "Reno",
        region: "NV",
        postalCode: "89506",
        country: "US",
      },
    ],
    externalIds: {
      acumaticaId: "ACU-CUST-19044",
      proprietarySystemId: "WB-CMS-7781",
    },
    creditTerms: "Net 45",
    lifetimeValue: 12_700_000,
    notes: "Top-5 account by revenue. Quarterly business reviews scheduled.",
  },
  {
    id: "C-1204",
    name: "Cooper & Vine Holdings",
    primaryContact: "Lin Cooper",
    accountSince: 2018,
    segment: "private_label",
    status: "active",
    primaryEmail: "vendors@cooperandvine.example",
    accountManager: "Sam Whitlock",
    salesRep: "Devon Hayes",
    parentCompanyId: null,
    brands: ["Cooper & Vine", "Vine Apothecary", "C&V Restore"],
    addresses: [
      {
        label: "Headquarters",
        line1: "200 Harvest Ln",
        city: "Sonoma",
        region: "CA",
        postalCode: "95476",
        country: "US",
      },
    ],
    externalIds: {
      acumaticaId: "ACU-CUST-17260",
      proprietarySystemId: "WB-CMS-6630",
    },
    creditTerms: "Net 30",
    lifetimeValue: 8_440_000,
    notes:
      "Three private-label brands; FPS approvals route through the parent contact.",
  },
  {
    id: "C-1311",
    name: "Verdant Roots Co.",
    primaryContact: "Jules Tanaka",
    accountSince: 2024,
    segment: "small",
    status: "prospect",
    primaryEmail: "hello@verdantroots.example",
    accountManager: "Jordan Reyes",
    salesRep: "Devon Hayes",
    parentCompanyId: null,
    brands: ["Verdant Roots"],
    addresses: [
      {
        label: "Headquarters",
        line1: "31 Birch St",
        city: "Asheville",
        region: "NC",
        postalCode: "28801",
        country: "US",
      },
    ],
    externalIds: {
      proprietarySystemId: "WB-CMS-11502",
    },
    creditTerms: "Prepaid",
    lifetimeValue: 0,
    notes: "First commercialization project in R&D. No invoiced orders yet.",
  },
];

export async function getCompanies(): Promise<Company[]> {
  return COMPANIES;
}

export async function getCompanyById(id: string): Promise<Company | null> {
  return COMPANIES.find(c => c.id === id) ?? null;
}

/**
 * Convenience: returns the company for the active session, falling back to a
 * minimal placeholder so the dashboard renders even if a session points at an
 * id we haven't backfilled yet.
 */
export async function getCompany(customerId: string): Promise<Company> {
  const found = await getCompanyById(customerId);
  if (found) return found;
  return {
    id: customerId,
    name: "Unknown Company",
    primaryContact: "—",
    accountSince: new Date().getFullYear(),
    status: "active",
  };
}

export const COMPANY_SEGMENT_LABEL: Record<NonNullable<Company["segment"]>, string> = {
  small: "Small brand",
  midmarket: "Midmarket",
  enterprise: "Enterprise",
  distributor: "Distributor",
  private_label: "Private label",
};

export const COMPANY_STATUS_META: Record<
  NonNullable<Company["status"]>,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  active: { label: "Active", tone: "success" },
  prospect: { label: "Prospect", tone: "info" },
  paused: { label: "Paused", tone: "warning" },
  former: { label: "Former", tone: "neutral" },
};
