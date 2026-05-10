/**
 * Onboarding Products Report — every active SKU we're working through with
 * a customer that hasn't yet hit recurring production. Mirrors the language
 * the customer success team uses internally (R&D / PH / Quoting stages).
 *
 * Future: replace with a join from the proprietary commercialization tracker.
 * `externalIds.proprietarySystemId` is the source-of-truth pointer.
 */

import type { ExternalIds } from "./types";

export type OnboardingStage =
  | "Quoting"
  | "R&D"
  | "PH"            // Pilot Hold / internal revision
  | "FPS Review"
  | "Approved";

export type OnboardingStageHistoryEntry = {
  stage: OnboardingStage;
  enteredOn: string;   // "4/12/26"
  exitedOn?: string;   // omitted for the current stage
};

export type OnboardingChangelogEntry = {
  date: string;
  author: string;
  note: string;
};

export type OnboardingDocument = {
  name: string;        // "Quote v2 — Stress Reset Blend.pdf"
  href?: string;
};

export type OnboardingProduct = {
  id: string;
  productName: string;
  sku: string;
  format: "Capsules" | "Powders" | "Liquids";
  count: string;       // "60 ct", "1oz", "100 lb bulk"
  stage: OnboardingStage;
  lastNote: string;
  lastUpdated: string; // formatted short date
  owner: string;       // who's holding the next step
  // Detail-card fields. Optional so list loaders can defer hydration to a
  // `getOnboardingProductById` lookup once the real backend is wired up.
  externalIds?: ExternalIds;
  targetLaunchDate?: string;
  formulationSummary?: string;
  pricePerUnit?: number;
  minimumOrderQuantity?: number;
  stageHistory?: OnboardingStageHistoryEntry[];
  documents?: OnboardingDocument[];
  changelog?: OnboardingChangelogEntry[];
};

export async function getOnboardingProducts(
  _customerId: string,
): Promise<OnboardingProduct[]> {
  return [
    {
      id: "ob-1",
      productName: "Stress Reset Blend",
      sku: "DTB-CAP-001",
      format: "Capsules",
      count: "60 ct",
      stage: "R&D",
      lastNote:
        "Awaiting R&D for L-theanine + ashwagandha ratio confirmation. Pilot batch targeted for week of 5/19.",
      lastUpdated: "5/6/26",
      owner: "WB R&D",
      externalIds: { proprietarySystemId: "WB-CMS-PROJ-7741" },
      targetLaunchDate: "Q3 2026",
      formulationSummary:
        "L-theanine 200mg + ashwagandha (KSM-66) 300mg + lemon balm extract 4:1, in vegetarian capsule.",
      pricePerUnit: 0.74,
      minimumOrderQuantity: 5000,
      stageHistory: [
        { stage: "Quoting", enteredOn: "3/14/26", exitedOn: "3/28/26" },
        { stage: "R&D", enteredOn: "3/28/26" },
      ],
      documents: [
        { name: "Quote v1 — Stress Reset Blend.pdf" },
        { name: "Pilot run protocol — draft.pdf" },
      ],
      changelog: [
        { date: "5/6/26", author: "Marco Liu", note: "R&D requested two extra ratios for sensory comparison." },
        { date: "4/22/26", author: "Jordan Reyes", note: "Pilot batch slot confirmed for week of 5/19." },
      ],
    },
    {
      id: "ob-2",
      productName: "Daily Greens Boost",
      sku: "DTB-PWD-002",
      format: "Powders",
      count: "30-serving canister",
      stage: "PH",
      lastNote:
        "In internal revision — adjusting moringa load to hit 12g serving size without exceeding bulk density spec.",
      lastUpdated: "5/2/26",
      owner: "WB Production",
      externalIds: { proprietarySystemId: "WB-CMS-PROJ-7782" },
      targetLaunchDate: "Q4 2026",
      formulationSummary:
        "Moringa, spirulina, alfalfa, barley grass, lemon, with stevia. 12g serving target.",
      pricePerUnit: 6.20,
      minimumOrderQuantity: 2400,
      stageHistory: [
        { stage: "Quoting", enteredOn: "2/2/26", exitedOn: "2/19/26" },
        { stage: "R&D", enteredOn: "2/19/26", exitedOn: "4/24/26" },
        { stage: "PH", enteredOn: "4/24/26" },
      ],
      documents: [{ name: "Pilot bulk-density report v1.pdf" }],
      changelog: [
        { date: "5/2/26", author: "WB Production", note: "Reformulating with finer-mesh moringa to hit density spec." },
      ],
    },
    {
      id: "ob-3",
      productName: "Recovery Tincture",
      sku: "DTB-LIQ-003",
      format: "Liquids",
      count: "2 oz",
      stage: "Quoting",
      lastNote:
        "Requoting V2 with revised passionflower source. New quote returned within 5–6 business days of your sign-off.",
      lastUpdated: "5/7/26",
      owner: "WB Sales",
      externalIds: { proprietarySystemId: "WB-CMS-PROJ-7820" },
      targetLaunchDate: "Q1 2027",
      formulationSummary:
        "Passionflower + skullcap + magnesium glycinate in alcohol-free glycerite base.",
      pricePerUnit: 4.10,
      minimumOrderQuantity: 3000,
      stageHistory: [{ stage: "Quoting", enteredOn: "4/12/26" }],
      documents: [{ name: "Quote v1 — Recovery Tincture.pdf" }],
      changelog: [
        { date: "5/7/26", author: "Priya Patel", note: "Customer requested re-quote with new passionflower vendor." },
      ],
    },
    {
      id: "ob-4",
      productName: "Cognitive Edge",
      sku: "DTB-CAP-004",
      format: "Capsules",
      count: "90 ct",
      stage: "FPS Review",
      lastNote:
        "Finished Product Specification drafted and sent to your team 5/5. Awaiting your countersignature to release deposit + production slot.",
      lastUpdated: "5/5/26",
      owner: "Customer",
      externalIds: { proprietarySystemId: "WB-CMS-PROJ-7644" },
      targetLaunchDate: "Q3 2026",
      formulationSummary:
        "Lion's mane (1:1 dual-extract) + bacopa + alpha-GPC in pullulan capsule.",
      pricePerUnit: 0.92,
      minimumOrderQuantity: 5000,
      stageHistory: [
        { stage: "Quoting", enteredOn: "1/8/26", exitedOn: "1/22/26" },
        { stage: "R&D", enteredOn: "1/22/26", exitedOn: "3/11/26" },
        { stage: "PH", enteredOn: "3/11/26", exitedOn: "4/30/26" },
        { stage: "FPS Review", enteredOn: "4/30/26" },
      ],
      documents: [
        { name: "FPS — Cognitive Edge 90ct v1.pdf" },
        { name: "Pilot batch summary — 4/22.pdf" },
      ],
      changelog: [
        { date: "5/5/26", author: "Marco Liu", note: "FPS sent. Awaiting countersignature." },
      ],
    },
    {
      id: "ob-5",
      productName: "Joint Mobility Blend",
      sku: "DTB-CAP-005",
      format: "Capsules",
      count: "120 ct",
      stage: "Approved",
      lastNote:
        "FPS approved. First production run scheduled the week of 6/9. Will roll into your standing weekly Friday open-order report from there.",
      lastUpdated: "5/1/26",
      owner: "WB Production",
      externalIds: { proprietarySystemId: "WB-CMS-PROJ-7510" },
      targetLaunchDate: "Q3 2026",
      formulationSummary:
        "Glucosamine HCl + boswellia serrata 65% + curcumin C3 + black pepper.",
      pricePerUnit: 1.18,
      minimumOrderQuantity: 6000,
      stageHistory: [
        { stage: "Quoting", enteredOn: "11/14/25", exitedOn: "12/3/25" },
        { stage: "R&D", enteredOn: "12/3/25", exitedOn: "2/19/26" },
        { stage: "PH", enteredOn: "2/19/26", exitedOn: "3/30/26" },
        { stage: "FPS Review", enteredOn: "3/30/26", exitedOn: "5/1/26" },
        { stage: "Approved", enteredOn: "5/1/26" },
      ],
      documents: [
        { name: "FPS — Joint Mobility 120ct v3 (signed).pdf" },
        { name: "Production schedule — wk of 6/9.pdf" },
      ],
      changelog: [
        { date: "5/1/26", author: "WB Production", note: "Run booked for week of 6/9 on Encap Line 1." },
        { date: "4/30/26", author: "Customer", note: "FPS countersigned." },
      ],
    },
  ];
}

/**
 * Detail lookup for a single onboarding project. The list loader hydrates
 * detail fields today; once the proprietary commercialization tracker is
 * wired up, this becomes a single `crm.projects.get(id)` call.
 */
export async function getOnboardingProductById(
  customerId: string,
  id: string,
): Promise<OnboardingProduct | null> {
  const all = await getOnboardingProducts(customerId);
  return all.find(p => p.id === id) ?? null;
}

export const ONBOARDING_STAGE_META: Record<
  OnboardingStage,
  { tone: "neutral" | "info" | "success" | "warning" | "danger"; description: string }
> = {
  Quoting: { tone: "info", description: "Sales is preparing or revising your quote." },
  "R&D": { tone: "info", description: "Formulation, flavor, or pilot work in progress." },
  PH: { tone: "warning", description: "Pilot Hold — internal revision before next pass." },
  "FPS Review": { tone: "warning", description: "Finished Product Spec waiting on your signature." },
  Approved: { tone: "success", description: "Spec approved — moving into production scheduling." },
};
