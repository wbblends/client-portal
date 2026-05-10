/**
 * Onboarding Products Report — every active SKU we're working through with
 * a customer that hasn't yet hit recurring production. Mirrors the language
 * the customer success team uses internally (R&D / PH / Quoting stages).
 *
 * Future: replace with a join from the proprietary commercialization tracker.
 */

export type OnboardingStage =
  | "Quoting"
  | "R&D"
  | "PH"            // Pilot Hold / internal revision
  | "FPS Review"
  | "Approved";

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
};

/**
 * Pipeline order — left-to-right Kanban column order. Mirrors the natural
 * progression of a SKU through commercialization, so the board reads like
 * a process map rather than an alphabetized list.
 */
export const ONBOARDING_STAGE_ORDER: readonly OnboardingStage[] = [
  "Quoting",
  "R&D",
  "PH",
  "FPS Review",
  "Approved",
] as const;

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
    },
    {
      id: "ob-6",
      productName: "Sleep Stack PM",
      sku: "DTB-CAP-006",
      format: "Capsules",
      count: "60 ct",
      stage: "Quoting",
      lastNote:
        "Initial quote drafted. Confirming melatonin grade + glycinate source before sending pricing tier breakdown.",
      lastUpdated: "5/8/26",
      owner: "WB Sales",
    },
    {
      id: "ob-7",
      productName: "Hydration Plus Electrolytes",
      sku: "DTB-PWD-007",
      format: "Powders",
      count: "20-stick carton",
      stage: "R&D",
      lastNote:
        "Bench trial #2 underway — solubility passes, dialing back stevia by 8% per your tasting panel feedback.",
      lastUpdated: "5/4/26",
      owner: "WB R&D",
    },
    {
      id: "ob-8",
      productName: "Immune Defense Shot",
      sku: "DTB-LIQ-008",
      format: "Liquids",
      count: "1.5 oz",
      stage: "FPS Review",
      lastNote:
        "FPS revision 2 sent 5/3 incorporating your label-claim language. Awaiting sign-off — flagged at standing Tuesday call.",
      lastUpdated: "5/3/26",
      owner: "Customer",
    },
    {
      id: "ob-9",
      productName: "Pre-Workout Pump",
      sku: "DTB-PWD-009",
      format: "Powders",
      count: "40-serving tub",
      stage: "PH",
      lastNote:
        "Pilot hold — beta-alanine tingle profile flagged on first run. Reformulating buffer system, second pilot week of 5/26.",
      lastUpdated: "4/29/26",
      owner: "WB R&D",
    },
  ];
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
