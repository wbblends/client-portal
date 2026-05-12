/**
 * Static placeholder kanban data for the marketing dashboard. Used when the
 * HubSpot token is missing OR when the live fetch fails/times out, so the UI
 * always renders something demo-able.
 *
 * Lives in its own file (rather than inline in `hubspot.ts`) so the ~600-line
 * static blob doesn't bloat every server bundle that imports a single live
 * fetcher.
 */
import type { DealOwner, KanbanData } from "./hubspot";

const PLACEHOLDER_OWNER: DealOwner = { id: "279126041", name: "Devin Simmons", initials: "DS" };
const HS_PLACEHOLDER_URL = "https://app.hubspot.com/contacts/20659581";

// Pipeline labels are inlined here (rather than imported from hubspot.ts) so
// this module has no runtime dependency on hubspot.ts — keeps the
// import graph acyclic and the placeholder file standalone.
const SALES_LABEL = "Sales Pipeline";
const EXPANSION_LABEL = "Account Expansion";

export const PLACEHOLDER_KANBAN: KanbanData = {
  source: "placeholder",
  pipelines: [
    {
      key: "sales",
      label: SALES_LABEL,
      stages: [
        {
          id: "appt-scheduled",
          label: "Appointment Scheduled",
          probability: 0.2,
          isClosed: false,
          totalAmount: 425_000,
          dealCount: 4,
          deals: [
            { id: "d1", name: "Kilo Health — Adaptogen Tincture", amount: 145_000, weighted: 29_000, closeDate: "2026-06-15", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d2", name: "Pure Encapsulations — Liver Support", amount: 95_000, weighted: 19_000, closeDate: "2026-06-30", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d3", name: "Thorne — Joint Powder Reformulation", amount: 110_000, weighted: 22_000, closeDate: "2026-07-08", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d4", name: "Gaia Herbs — Sleep Capsule Run", amount: 75_000, weighted: 15_000, closeDate: "2026-07-22", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "qualified",
          label: "Qualified to Buy",
          probability: 0.4,
          isClosed: false,
          totalAmount: 880_000,
          dealCount: 5,
          deals: [
            { id: "d5", name: "MegaFood — Women's Multi Bulk", amount: 225_000, weighted: 90_000, closeDate: "2026-06-12", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d6", name: "Garden of Life — Probiotic Blend", amount: 180_000, weighted: 72_000, closeDate: "2026-06-20", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d7", name: "Nordic Naturals — Omega Capsules", amount: 165_000, weighted: 66_000, closeDate: "2026-07-01", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d8", name: "New Chapter — Turmeric Force", amount: 155_000, weighted: 62_000, closeDate: "2026-07-15", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d9", name: "Ritual — Stress Relief Gummies", amount: 155_000, weighted: 62_000, closeDate: "2026-07-29", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "presentation",
          label: "Presentation Scheduled",
          probability: 0.6,
          isClosed: false,
          totalAmount: 1_265_000,
          dealCount: 4,
          deals: [
            { id: "d10", name: "Standard Process — Greens Powder", amount: 340_000, weighted: 204_000, closeDate: "2026-05-30", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d11", name: "Now Foods — Elderberry Syrup", amount: 285_000, weighted: 171_000, closeDate: "2026-06-10", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d12", name: "Solgar — Vitamin D3 Liquid", amount: 320_000, weighted: 192_000, closeDate: "2026-06-18", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d13", name: "Jarrow — Adrenal Tonic", amount: 320_000, weighted: 192_000, closeDate: "2026-06-25", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "decision",
          label: "Decision Maker Bought-In",
          probability: 0.8,
          isClosed: false,
          totalAmount: 1_125_000,
          dealCount: 3,
          deals: [
            { id: "d14", name: "Pure Synergy — Immune Capsules", amount: 410_000, weighted: 328_000, closeDate: "2026-05-25", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d15", name: "HUM Nutrition — Hair Support", amount: 365_000, weighted: 292_000, closeDate: "2026-06-05", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d16", name: "Olly — Mood Support Gummies", amount: 350_000, weighted: 280_000, closeDate: "2026-06-12", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "contract",
          label: "Contract Sent",
          probability: 0.9,
          isClosed: false,
          totalAmount: 555_000,
          dealCount: 2,
          deals: [
            { id: "d17", name: "Vital Proteins — Collagen Tincture", amount: 295_000, weighted: 265_500, closeDate: "2026-05-20", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "d18", name: "Onnit — Energy Blend", amount: 260_000, weighted: 234_000, closeDate: "2026-05-28", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
      ],
    },
    {
      key: "expansion",
      label: EXPANSION_LABEL,
      stages: [
        {
          id: "exp-identified",
          label: "Opportunity Identified",
          probability: 0.15,
          isClosed: false,
          totalAmount: 295_000,
          dealCount: 6,
          deals: [
            { id: "e1", name: "Kilo Health — Add Capsule SKU", amount: 55_000, weighted: 8_250, closeDate: "2026-07-15", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e2", name: "Thorne — Q3 Reorder Increase", amount: 48_000, weighted: 7_200, closeDate: "2026-07-22", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e3", name: "Garden of Life — Add Liquid Format", amount: 62_000, weighted: 9_300, closeDate: "2026-08-01", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e4", name: "MegaFood — Bulk Discount Tier", amount: 35_000, weighted: 5_250, closeDate: "2026-08-10", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e5", name: "Now Foods — New Flavor Run", amount: 52_000, weighted: 7_800, closeDate: "2026-08-18", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e6", name: "Solgar — Powder Conversion", amount: 43_000, weighted: 6_450, closeDate: "2026-08-25", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "exp-discovery",
          label: "Discovery Call",
          probability: 0.35,
          isClosed: false,
          totalAmount: 410_000,
          dealCount: 7,
          deals: [
            { id: "e7", name: "Standard Process — Add 2 SKUs", amount: 72_000, weighted: 25_200, closeDate: "2026-07-05", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e8", name: "Jarrow — Annual Volume Bump", amount: 65_000, weighted: 22_750, closeDate: "2026-07-12", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e9", name: "HUM Nutrition — Reformulate", amount: 58_000, weighted: 20_300, closeDate: "2026-07-20", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e10", name: "Olly — Quarterly Standing Order", amount: 55_000, weighted: 19_250, closeDate: "2026-07-28", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e11", name: "Onnit — New Tincture Line", amount: 60_000, weighted: 21_000, closeDate: "2026-08-05", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e12", name: "Ritual — Replace Existing Vendor", amount: 50_000, weighted: 17_500, closeDate: "2026-08-12", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e13", name: "Pure Synergy — Capsule Upgrade", amount: 50_000, weighted: 17_500, closeDate: "2026-08-19", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "exp-proposal",
          label: "Proposal Sent",
          probability: 0.6,
          isClosed: false,
          totalAmount: 540_000,
          dealCount: 6,
          deals: [
            { id: "e14", name: "Nordic Naturals — Omega Tincture", amount: 105_000, weighted: 63_000, closeDate: "2026-06-15", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e15", name: "Vital Proteins — Add Powder", amount: 95_000, weighted: 57_000, closeDate: "2026-06-22", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e16", name: "Gaia Herbs — Sleep Reformulate", amount: 85_000, weighted: 51_000, closeDate: "2026-07-01", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e17", name: "New Chapter — 2x Volume", amount: 90_000, weighted: 54_000, closeDate: "2026-07-08", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e18", name: "Pure Encapsulations — Add Liquid", amount: 78_000, weighted: 46_800, closeDate: "2026-07-15", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e19", name: "MegaFood — Multi Format", amount: 87_000, weighted: 52_200, closeDate: "2026-07-22", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
        {
          id: "exp-negotiation",
          label: "Negotiation",
          probability: 0.85,
          isClosed: false,
          totalAmount: 360_000,
          dealCount: 5,
          deals: [
            { id: "e20", name: "Garden of Life — Probiotic Expansion", amount: 78_000, weighted: 66_300, closeDate: "2026-05-20", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e21", name: "Thorne — Joint Powder Add-On", amount: 72_000, weighted: 61_200, closeDate: "2026-05-27", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e22", name: "Ritual — Stress Gummy Volume", amount: 75_000, weighted: 63_750, closeDate: "2026-06-03", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e23", name: "Solgar — Annual Renewal", amount: 70_000, weighted: 59_500, closeDate: "2026-06-10", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
            { id: "e24", name: "Olly — Capsule Conversion", amount: 65_000, weighted: 55_250, closeDate: "2026-06-17", companyName: null, companyDomain: null, monthExpected: null, tier: null, format: null, productCategory: null, owner: PLACEHOLDER_OWNER, hubspotUrl: HS_PLACEHOLDER_URL, lastModified: null },
          ],
        },
      ],
    },
  ],
};
