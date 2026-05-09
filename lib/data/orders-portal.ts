/**
 * Seed data for the Orders Portal "by-customer" view, mirroring the 2026 POs
 * tab in the sales metrics workbook. Today this module just exports a static
 * snapshot — the spreadsheet UI then takes over and persists user edits to
 * localStorage. Future: replace this export with an Acumatica pull
 * (`acumatica.salesOrders.byCustomer({ year })`) and merge with the
 * proprietary forecasting data.
 */

export type Tier = "AA" | "A" | "B" | "C";

export type OrdersPortalRow = {
  id: string;
  customer: string;
  rep: string;
  cs: string;
  tier: Tier | "";
  projection: number;
  /** 12 entries: Jan..Dec. null = no value entered yet (renders blank). */
  months: (number | null)[];
};

/**
 * Per-month sales targets for the year, used in the totals strip.
 * Mirrors the "Target" row from the workbook.
 */
export const MONTHLY_TARGETS: number[] = [
  8_135_000, 8_135_000, 8_177_000, 8_743_000, 9_293_000, 9_343_000,
  9_635_000, 9_635_000, 9_685_000, 9_685_000, 9_685_000, 9_685_000,
];

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Helper to build a 12-slot months array from a sparse map of month index -> amount. */
function months(values: Record<number, number>): (number | null)[] {
  const out: (number | null)[] = Array(12).fill(null);
  for (const [k, v] of Object.entries(values)) out[Number(k)] = v;
  return out;
}

/**
 * Snapshot from the 2026 POs tab as of the latest export. Numbers represent
 * actual booked PO amounts ($) per month, per customer.
 */
export const ORDERS_PORTAL_SEED: OrdersPortalRow[] = [
  { id: "r-innosupps", customer: "Innosupps", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 8_000_000,
    months: months({ 0: 97_650 }) },
  { id: "r-kilo", customer: "Kilo Health", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 8_000_000,
    months: months({ 0: 3_410_300, 2: 1_564_000, 4: 1_480_000 }) },
  { id: "r-dfh", customer: "Designs For Health", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 5_000_000,
    months: months({ 0: 1_307_828.32, 1: 451_868.64, 2: 553_264.72 }) },
  { id: "r-goldenhippo", customer: "Golden Hippo", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 4_000_000,
    months: months({ 0: 1_985_050, 1: 118_000 }) },
  { id: "r-nativepath", customer: "Native Path", rep: "Jacob", cs: "Courtney", tier: "A", projection: 2_000_000,
    months: months({ 0: 77_425, 1: 104_500, 2: 31_350 }) },
  { id: "r-silverfern", customer: "Silver Fern", rep: "Jacob", cs: "Courtney", tier: "A", projection: 4_000_000,
    months: months({ 0: 1_398_000, 1: 757_800, 2: 1_084_650, 3: 821_450 }) },
  { id: "r-swolverine", customer: "Swolverine", rep: "Jacob", cs: "Courtney", tier: "B", projection: 2_000_000,
    months: months({ 2: 715_350 }) },
  { id: "r-justingredients", customer: "Just Ingredients", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 2_000_000,
    months: months({ 1: 161_100, 4: 80_250 }) },
  { id: "r-bcompany", customer: "B Company", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 1_500_000,
    months: months({}) },
  { id: "r-paleovalley", customer: "Paleo Valley", rep: "Jacob", cs: "Courtney", tier: "B", projection: 1_000_000,
    months: months({}) },
  { id: "r-nutricost", customer: "Nutricost", rep: "Jacob", cs: "Courtney", tier: "B", projection: 500_000,
    months: months({ 1: 27_450 }) },
  { id: "r-kinobody", customer: "Kinobody", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 1_000_000,
    months: months({ 0: 54_400, 1: 80_550, 2: 24_975, 3: 67_100 }) },
  { id: "r-truheights", customer: "TruHeights", rep: "Jacob", cs: "Courtney", tier: "B", projection: 1_000_000,
    months: months({}) },
  { id: "r-jackedfactory", customer: "Jacked Factory", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 1_000_000,
    months: months({ 3: 63_975 }) },
  { id: "r-konciousketo", customer: "Koncious Keto", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 1_000_000,
    months: months({ 1: 496_000 }) },
  { id: "r-ersolutions", customer: "ER Solutions", rep: "Jacob", cs: "Courtney", tier: "AA", projection: 750_000,
    months: months({ 2: 342_500, 3: 670_000 }) },
  { id: "r-carnivoreaurelius", customer: "Carnivore Aurelius", rep: "Jacob", cs: "Lindsay", tier: "C", projection: 500_000,
    months: months({ 1: 33_825, 3: 48_995, 4: 127_100 }) },
  { id: "r-mentomars", customer: "Men To Mars", rep: "Landon", cs: "Ashley", tier: "AA", projection: 12_000_000,
    months: months({ 0: 2_508_000, 2: 1_888_200, 3: 3_135_000, 4: 3_010_000 }) },
  { id: "r-vshred", customer: "V Shred", rep: "Landon", cs: "Laury", tier: "A", projection: 6_000_000,
    months: months({ 3: 649_466.9 }) },
  { id: "r-ancientnutrition", customer: "Ancient Nutrition", rep: "Landon", cs: "Lindsay", tier: "A", projection: 3_000_000,
    months: months({ 0: 526_300, 2: 1_114_000, 3: 828_950.85 }) },
  { id: "r-fuelhealth", customer: "Fuel Health", rep: "Landon", cs: "Ashley", tier: "AA", projection: 1_000_000,
    months: months({ 3: 555_000, 4: 1_100_000 }) },
  { id: "r-supreme", customer: "Supreme", rep: "Landon", cs: "Ashley", tier: "A", projection: 1_250_000,
    months: months({ 0: 71_769.81, 1: 148_964, 2: 80_161, 3: 121_043 }) },
  { id: "r-codeage", customer: "Codeage", rep: "Landon", cs: "Ayrton", tier: "A", projection: 2_000_000,
    months: months({ 1: 91_415, 2: 82_050, 3: 103_350 }) },
  { id: "r-misc-landon", customer: "Misc.", rep: "Landon", cs: "", tier: "", projection: 0,
    months: months({ 3: 7_800 }) },
  { id: "r-barlow", customer: "Barlow", rep: "Landon", cs: "Ashley", tier: "B", projection: 450_000,
    months: months({ 0: 131_960, 4: 23_100 }) },
  { id: "r-traceminerals", customer: "Trace Minerals", rep: "Casey", cs: "Ayrton", tier: "A", projection: 3_000_000,
    months: months({ 3: 219_300 }) },
  { id: "r-umzu", customer: "Umzu", rep: "Casey", cs: "Ashley", tier: "A", projection: 4_000_000,
    months: months({ 0: 61_144, 1: 551_500, 3: 166_600 }) },
  { id: "r-bioptimizers", customer: "Bioptimizers", rep: "Casey", cs: "Ashley", tier: "A", projection: 5_000_000,
    months: months({ 0: 356_000, 1: 143_320, 2: 129_725, 3: 48_800 }) },
  { id: "r-bridges", customer: "Bridges / Cystex / Eco", rep: "Casey", cs: "Ayrton", tier: "B", projection: 750_000,
    months: months({ 0: 92_600 }) },
  { id: "r-biogenetix", customer: "Biogenetix", rep: "Casey", cs: "Ayrton", tier: "C", projection: 350_000,
    months: months({ 0: 23_850 }) },
  { id: "r-veracity", customer: "Veracity", rep: "Casey", cs: "Ayrton", tier: "A", projection: 4_000_000,
    months: months({ 3: 268_200 }) },
  { id: "r-growve", customer: "Growve", rep: "Casey", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({ 1: 40_100, 2: 31_050, 3: 40_475 }) },
  { id: "r-argmm", customer: "ARG / MM", rep: "Casey", cs: "Ayrton", tier: "B", projection: 2_500_000,
    months: months({ 0: 160_824, 1: 116_640, 2: 64_800, 3: 138_339 }) },
  { id: "r-joyspring", customer: "Joyspring", rep: "Casey", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({}) },
  { id: "r-urbanmoonshine", customer: "Urban Moonshine", rep: "Casey", cs: "Ashley", tier: "C", projection: 125_000,
    months: months({ 0: 163_550 }) },
  { id: "r-truspan", customer: "TruSpan", rep: "Casey", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({ 0: 101_050, 3: 101_050 }) },
  { id: "r-thorne", customer: "Thorne", rep: "Casey", cs: "Ashley", tier: "A", projection: 2_000_000,
    months: months({ 2: 273_600, 3: 273_600 }) },
  { id: "r-justthrive", customer: "Just Thrive", rep: "Todd", cs: "Lindsay", tier: "B", projection: 500_000,
    months: months({ 1: 204_240 }) },
  { id: "r-scalemedia", customer: "Scale Media", rep: "Todd", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({ 1: 63_200 }) },
  { id: "r-terabiotech", customer: "Terabiotech", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({}) },
  { id: "r-cleannutra", customer: "Clean Nutraceuticals", rep: "Todd", cs: "Ayrton", tier: "AA", projection: 4_000_000,
    months: months({ 1: 67_365, 2: 237_000, 3: 252_585, 4: 55_080 }) },
  { id: "r-platinumhealth", customer: "Platinum Health", rep: "Todd", cs: "Ashley", tier: "C", projection: 250_000,
    months: months({}) },
  { id: "r-nodayswasted", customer: "No Days Wasted Labs", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 0: 32_500 }) },
  { id: "r-procare", customer: "ProCare", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 0: 53_300 }) },
  { id: "r-touchstone", customer: "Touchstone", rep: "Todd", cs: "Lindsay", tier: "B", projection: 750_000,
    months: months({ 0: 101_250, 1: 43_200, 2: 26_850, 3: 174_000 }) },
  { id: "r-vimergy", customer: "Vimergy", rep: "Todd", cs: "Lindsay", tier: "B", projection: 1_000_000,
    months: months({ 0: 389_700 }) },
  { id: "r-silveronyx", customer: "Silver Onyx", rep: "Nicole", cs: "Ashley", tier: "A", projection: 2_000_000,
    months: months({ 0: 143_460 }) },
  { id: "r-plusultra", customer: "Plus Ultra", rep: "Nicole", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 1: 38_800 }) },
  { id: "r-sportsresearch", customer: "Sports Research", rep: "Nicole", cs: "Ayrton", tier: "AA", projection: 2_000_000,
    months: months({ 1: 103_260, 3: 46_000 }) },
  { id: "r-gaia", customer: "Gaia Herbs", rep: "Nicole", cs: "Ashley", tier: "C", projection: 250_000,
    months: months({ 0: 30_966 }) },
  { id: "r-snap", customer: "SNAP", rep: "Nicole", cs: "Ashley", tier: "A", projection: 1_500_000,
    months: months({ 1: 406_750, 4: 293_250 }) },
];

/** Stable list of tier values for select inputs. */
export const TIERS: Tier[] = ["AA", "A", "B", "C"];

/** Reps observed in the workbook — also used as suggestions for new rows. */
export const REP_SUGGESTIONS = ["Jacob", "Landon", "Casey", "Todd", "Nicole"];
export const CS_SUGGESTIONS = ["Courtney", "Lindsay", "Ashley", "Ayrton", "Laury"];

/**
 * Per-rep color used to band rows in the grid and tag rep selects/badges.
 * Each entry has:
 *   - accent:  Tailwind border color for the row's left edge
 *   - bg:      a soft tint applied to the row when in the rep's "book"
 *   - chip:    pill background for the rep label
 *   - chipFg:  pill foreground
 */
export const REP_COLORS: Record<
  string,
  { accent: string; bg: string; chip: string; chipFg: string; dot: string }
> = {
  Jacob: {
    accent: "border-l-indigo-500",
    bg: "bg-indigo-50/40",
    chip: "bg-indigo-100",
    chipFg: "text-indigo-800",
    dot: "bg-indigo-500",
  },
  Landon: {
    accent: "border-l-emerald-500",
    bg: "bg-emerald-50/40",
    chip: "bg-emerald-100",
    chipFg: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  Casey: {
    accent: "border-l-amber-500",
    bg: "bg-amber-50/40",
    chip: "bg-amber-100",
    chipFg: "text-amber-900",
    dot: "bg-amber-500",
  },
  Todd: {
    accent: "border-l-rose-500",
    bg: "bg-rose-50/40",
    chip: "bg-rose-100",
    chipFg: "text-rose-800",
    dot: "bg-rose-500",
  },
  Nicole: {
    accent: "border-l-sky-500",
    bg: "bg-sky-50/40",
    chip: "bg-sky-100",
    chipFg: "text-sky-800",
    dot: "bg-sky-500",
  },
};

export function getRepColor(rep: string) {
  return (
    REP_COLORS[rep] ?? {
      accent: "border-l-transparent",
      bg: "",
      chip: "bg-accent",
      chipFg: "text-foreground-soft",
      dot: "bg-muted-soft",
    }
  );
}

/** Payment terms observed in order intake emails. */
export const PAYMENT_TERMS = ["N30", "N60", "N90", "Net 45", "COD", "Prepay", "Other"] as const;

/**
 * Pieces of an order intake. Mirrors the numbered list pattern used in
 * emails sent to orders@wbblends.com:
 *   1) Summary  2) Total Revenue  3) Payment Terms  4) Contacts
 *   5) Customer Supplied (Bottle/Lid/Sticker)  6) MISC
 *   + delivery schedule + PO/quote attachments.
 */
export type DeliveryRow = {
  id: string;
  weekOf: string; // mm/dd or yyyy-mm-dd, free-form
  units: number | null;
};

export type OrderAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export type OrderDraft = {
  id: string;
  createdAt: string;
  customer: string;
  rep: string;
  cs: string;
  poNumber: string;
  productName: string;
  summary: string;
  totalRevenue: number | null;
  paymentTerms: string;
  contactsUnchanged: boolean;
  contactsNote: string;
  customerSuppliedBottle: boolean;
  customerSuppliedLid: boolean;
  customerSuppliedSticker: boolean;
  misc: string;
  deliverySchedule: DeliveryRow[];
  attachments: OrderAttachment[];
};
