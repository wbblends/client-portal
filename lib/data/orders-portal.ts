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
  /**
   * Rolling forecast values, 12 entries Jan..Dec, parallel to `months`. The
   * grid surfaces three forecast columns at a time (current month + the next
   * two), so the visible window slides forward each month. Older slots stay
   * populated in the DB but stop rendering once they fall out of the window.
   */
  forecasts: (number | null)[];
};

/**
 * Per-month sales targets for the year, used in the totals strip.
 * Mirrors the "Target" row from the workbook.
 */
export const MONTHLY_TARGETS: number[] = [
  8_135_000, 8_135_000, 8_177_000, 8_743_000, 9_293_000, 9_343_000,
  9_635_000, 9_635_000, 9_685_000, 9_685_000, 9_685_000, 9_685_000,
];

/**
 * 2025 monthly PO revenue actuals — historical, used as the prior-year
 * baseline in the Monthly POs Received chart on the home and orders pages.
 * These are the column sums of ORDERS_PORTAL_SEED_2025 below; the two must
 * stay in agreement.
 *
 * May is $204,911.52 higher than the workbook's own May total: one customer
 * (Trace) has its May cell stored as text in the source sheet, so Excel's
 * SUM silently drops it. It is real revenue, so the portal counts it.
 */
export const ACTUALS_2025: { month: string; value: number }[] = [
  { month: "Jan", value: 4_662_705 },
  { month: "Feb", value: 5_038_802 },
  { month: "Mar", value: 6_618_716 },
  { month: "Apr", value: 7_109_174 },
  { month: "May", value: 7_273_664 },
  { month: "Jun", value: 5_725_431 },
  { month: "Jul", value: 9_589_585 },
  { month: "Aug", value: 7_111_473 },
  { month: "Sep", value: 6_037_133 },
  { month: "Oct", value: 8_733_145 },
  { month: "Nov", value: 6_998_905 },
  { month: "Dec", value: 8_376_343 },
];

/**
 * Years the Orders Portal keeps a per-customer PO grid for. The grid shows
 * one year at a time behind a year tab. CURRENT_PO_YEAR is the live year —
 * forecast columns and the month-to-date cards apply only to it; prior years
 * render as a closed book of final actuals. Add the next year here (and a
 * seed below) when the team rolls over.
 *
 * Customer rows are linked across years by customer name. That name pairing
 * is the join a future "when is this customer due for another order"
 * predictor will lean on — keep names consistent year over year.
 */
export const PO_YEARS = [2025, 2026] as const;
export const CURRENT_PO_YEAR = 2026;

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

/** Empty 12-slot forecast array used when seeding new rows. */
export function emptyForecasts(): (number | null)[] {
  return Array(12).fill(null);
}

/**
 * Snapshot from the 2026 POs tab as of the latest export. Numbers represent
 * actual booked PO amounts ($) per month, per customer. Forecasts seed empty
 * — admins fill them in via the grid's forecast columns (current month
 * through December).
 */
type SeedRow = Omit<OrdersPortalRow, "forecasts">;
const SEED_ROWS_RAW: SeedRow[] = [
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

export const ORDERS_PORTAL_SEED: OrdersPortalRow[] = SEED_ROWS_RAW.map(r => ({
  ...r,
  forecasts: emptyForecasts(),
}));

/**
 * Snapshot of the "2025 POs" tab — last year's final, per-customer PO
 * actuals. 2025 is a closed year: there is no forecast and no monthly target
 * row in the source, so the grid renders this year as plain actuals. Numbers
 * are booked PO amounts ($) per month, per customer.
 */
const SEED_ROWS_2025_RAW: SeedRow[] = [
  { id: "r25-innosupps", customer: "Innosupps", rep: "Jacob", cs: "Courtney", tier: "A", projection: 8_000_000,
    months: months({ 0: 300000, 1: 1850000, 2: 984750, 3: 475000, 8: 225000, 9: 2210050, 11: 3042270 }) },
  { id: "r25-kilo-health", customer: "Kilo Health", rep: "Jacob", cs: "Courtney", tier: "A", projection: 5_000_000,
    months: months({ 0: 808000, 1: 591600, 2: 1429140, 3: 1572800, 4: 652500, 5: 112050, 6: 3703300, 7: 240340, 8: 266400, 9: 119280 }) },
  { id: "r25-er-solutions", customer: "ER Solutions", rep: "Jacob", cs: "Courtney", tier: "B", projection: 750_000,
    months: months({ 6: 78000, 7: 158200 }) },
  { id: "r25-b-company", customer: "B Company", rep: "Jacob", cs: "Courtney", tier: "B", projection: 750_000,
    months: months({ 7: 751400 }) },
  { id: "r25-silver-fern", customer: "Silver Fern", rep: "Jacob", cs: "Courtney", tier: "A", projection: 2_500_000,
    months: months({ 0: 100000, 1: 321500, 2: 328700, 3: 86710, 4: 323450, 5: 343815, 6: 532300, 7: 706850, 8: 166500, 9: 417200, 10: 428300, 11: 300950 }) },
  { id: "r25-native-path", customer: "Native Path", rep: "Jacob", cs: "Courtney", tier: "A", projection: 2_000_000,
    months: months({ 1: 57000, 2: 291000, 3: 626100, 4: 242000, 5: 641940, 6: 1020300, 8: 202550, 10: 51300, 11: 385030 }) },
  { id: "r25-paleo-valley", customer: "Paleo Valley", rep: "Jacob", cs: "Courtney", tier: "B", projection: 2_000_000,
    months: months({ 0: 200000, 4: 261000, 6: 53400, 10: 209000 }) },
  { id: "r25-kinobody", customer: "Kinobody", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 750_000,
    months: months({ 0: 210000, 1: 25550, 2: 120200, 3: 338300, 6: 26250, 7: 20950, 8: 172600, 11: 95850 }) },
  { id: "r25-designs-for-health", customer: "Designs For Health", rep: "Jacob", cs: "Courtney", tier: "A", projection: 1_500_000,
    months: months({ 2: 863341.6, 3: 215981.28, 5: 274127, 6: 214863.24, 7: 1087150, 8: 810760.68, 9: 61200, 10: 1462063.13, 11: 1280574.04 }) },
  { id: "r25-golden-hippo", customer: "Golden Hippo", rep: "Jacob", cs: "Courtney", tier: "A", projection: 2_000_000,
    months: months({ 2: 257000, 6: 1015500, 9: 300400, 10: 42300, 11: 166800 }) },
  { id: "r25-truheights", customer: "TruHeights", rep: "Jacob", cs: "Courtney", tier: "B", projection: 2_000_000,
    months: months({ 5: 127500, 9: 12500 }) },
  { id: "r25-koncious-keto", customer: "Koncious Keto", rep: "Jacob", cs: "Lindsay", tier: "C", projection: 2_000_000,
    months: months({ 5: 106400, 8: 517000, 10: 496000 }) },
  { id: "r25-nutricost", customer: "Nutricost", rep: "Jacob", cs: "Courtney", tier: "C", projection: 250_000,
    months: months({ 3: 60660, 9: 70000 }) },
  { id: "r25-relay-peak", customer: "Relay Peak", rep: "Jacob", cs: "Lindsay", tier: "C", projection: 500_000,
    months: months({ 0: 39400, 5: 256650 }) },
  { id: "r25-jacked-factory", customer: "Jacked Factory", rep: "Jacob", cs: "Lindsay", tier: "C", projection: 500_000,
    months: months({ 1: 117000, 5: 49950, 6: 251000, 11: 365968 }) },
  { id: "r25-swolverine", customer: "Swolverine", rep: "Jacob", cs: "Courtney", tier: "B", projection: 500_000,
    months: months({ 7: 500790, 9: 325700 }) },
  { id: "r25-slamit-supplements", customer: "SlamIt Supplements", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 250_000,
    months: months({ 5: 97000 }) },
  { id: "r25-carnivore-aurelius", customer: "Carnivore Aurelius", rep: "Jacob", cs: "Lindsay", tier: "B", projection: 250_000,
    months: months({ 7: 166050, 11: 127100 }) },
  { id: "r25-oxy-naturals", customer: "Oxy Naturals", rep: "Jacob", cs: "Courtney", tier: "C", projection: 500_000,
    months: months({ 4: 38700, 5: 36200, 10: 69200 }) },
  { id: "r25-ancient-nutrition", customer: "Ancient Nutrition", rep: "Landon", cs: "Lindsay", tier: "B", projection: 4_500_000,
    months: months({ 0: 338000, 1: 421660, 2: 437250, 3: 72850, 4: 153000, 5: 567000, 6: 371000, 7: 275000, 8: 597700, 9: 194900, 10: 235600, 11: 200000 }) },
  { id: "r25-snap", customer: "SNAP", rep: "Landon", cs: "Ashley", tier: "A", projection: 1_500_000,
    months: months({ 1: 596000, 2: 207500, 3: 738750, 4: 936970, 5: 205000, 6: 12600 }) },
  { id: "r25-v-shred", customer: "V Shred", rep: "Landon", cs: "Laury", tier: "A", projection: 6_500_000,
    months: months({ 0: 1000000, 3: 1045387.19, 4: 242743.29, 6: 1100000, 10: 2033056.9 }) },
  { id: "r25-barlow", customer: "Barlow", rep: "Landon", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 0: 100000, 1: 28220, 3: 42650, 5: 194365, 6: 8720 }) },
  { id: "r25-supreme", customer: "Supreme", rep: "Landon", cs: "Ashley", tier: "B", projection: 1_000_000,
    months: months({ 0: 290051, 1: 102573, 2: 157038, 3: 23077, 4: 67150, 5: 171000, 7: 115000, 8: 88332, 11: 237800 }) },
  { id: "r25-juna", customer: "Juna", rep: "Landon", cs: "Ayrton", tier: "C", projection: 400_000,
    months: months({ 1: 67984, 6: 64960, 8: 64095 }) },
  { id: "r25-fir-meadow", customer: "Fir Meadow", rep: "Landon", cs: "Ashley", tier: "C", projection: 150_000,
    months: months({ 9: 17055 }) },
  { id: "r25-fuel-health", customer: "Fuel Health", rep: "Landon", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 7: 375000, 8: 292500 }) },
  { id: "r25-men-to-mars", customer: "Men To Mars", rep: "Landon", cs: "Ashley", tier: "A", projection: 1_000_000,
    months: months({ 3: 1011030, 4: 950130, 5: 1260000, 7: 1260720, 8: 1260720, 9: 2508000 }) },
  { id: "r25-trace", customer: "Trace", rep: "Casey", cs: "Ayrton", tier: "A", projection: 2_500_000,
    months: months({ 0: 235056.76, 1: 35054.65, 2: 676480.73, 3: 455711.91, 4: 204911.52, 5: 224297.14, 7: 344360, 9: 197000 }) },
  { id: "r25-umzu", customer: "Umzu", rep: "Casey", cs: "Ashley", tier: "B", projection: 1_500_000,
    months: months({ 0: 708915.22, 1: 27387, 2: 146749.2, 3: 67320.54, 6: 271100, 7: 242750, 8: 557950, 9: 443000, 10: 32800, 11: 79100 }) },
  { id: "r25-bioptimizers", customer: "Bioptimizers", rep: "Casey", cs: "Ashley", tier: "A", projection: 3_000_000,
    months: months({ 4: 1541852.56, 7: 193820, 8: 94200, 10: 321533.8, 11: 64550 }) },
  { id: "r25-ac-arches", customer: "AC Arches", rep: "Casey", cs: "Ashley", tier: "C", projection: 350_000,
    months: months({ 1: 254285.46 }) },
  { id: "r25-bridges-cystex-eco", customer: "Bridges / Cystex / Eco", rep: "Casey", cs: "Ayrton", tier: "B", projection: 250_000,
    months: months({ 0: 81000, 2: 63947.52, 4: 86533.04, 8: 26880, 10: 92600, 11: 182890 }) },
  { id: "r25-biogenetix", customer: "Biogenetix", rep: "Casey", cs: "Ayrton", tier: "B", projection: 500_000,
    months: months({ 0: 96247.52, 2: 75614.69, 7: 37450, 8: 40680, 9: 14610, 10: 78190 }) },
  { id: "r25-veracity", customer: "Veracity", rep: "Casey", cs: "Ayrton", tier: "A", projection: 1_500_000,
    months: months({ 2: 86846.4, 4: 239700, 5: 211902.24, 6: 392000, 9: 987500, 10: 598258.12, 11: 599438 }) },
  { id: "r25-growve", customer: "Growve", rep: "Casey", cs: "Ayrton", tier: "B", projection: 350_000,
    months: months({ 4: 97348.42, 6: 121260, 10: 50470, 11: 25300 }) },
  { id: "r25-arg-mm", customer: "ARG/MM", rep: "Casey", cs: "Ayrton", tier: "B", projection: 1_500_000,
    months: months({ 1: 226078.21, 3: 79067.6, 4: 861492.85, 5: 35910, 6: 15950, 7: 138030, 8: 134205, 9: 221800, 10: 325265, 11: 50190 }) },
  { id: "r25-urban-moonshine", customer: "Urban Moonshine", rep: "Casey", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 1: 94950, 2: 67913.4, 4: 94095, 5: 62740, 6: 65496, 7: 111663.4, 8: 15225, 10: 132083.5, 11: 16068 }) },
  { id: "r25-senesciences-sls-performance", customer: "Senesciences / SLS Performance", rep: "Casey", cs: "Ashley", tier: "C", projection: 500_000,
    months: months({ 5: 166000 }) },
  { id: "r25-joyspring", customer: "Joyspring", rep: "Casey", cs: "Ayrton", tier: "B", projection: 300_000,
    months: months({ 4: 86207.42, 9: 37100, 11: 19500 }) },
  { id: "r25-truspan", customer: "TruSpan", rep: "Casey", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({ 2: 71044.6, 3: 103430.32, 9: 51250, 11: 93850 }) },
  { id: "r25-doublewood", customer: "Doublewood", rep: "Casey", cs: "Ayrton", tier: "C", projection: 500_000,
    months: months({ 1: 110000, 6: 55600, 9: 86100 }) },
  { id: "r25-thorne", customer: "Thorne", rep: "Casey", cs: "Ashley", tier: "A", projection: 500_000,
    months: months({ 9: 458500, 11: 642600 }) },
  { id: "r25-just-thrive", customer: "Just Thrive", rep: "Todd", cs: "Lindsay", tier: "B", projection: 500_000,
    months: months({ 0: 113035, 1: 57960, 5: 113035, 6: 68586, 8: 53845, 10: 113360 }) },
  { id: "r25-mercola", customer: "Mercola", rep: "Todd", cs: "Ashley", tier: "C", projection: 150_000,
    months: months({ 8: 16150 }) },
  { id: "r25-superhuman-health", customer: "SuperHuman Health", rep: "Todd", cs: "Ashley", tier: "C", projection: 500_000,
    months: months({ 7: 14250, 8: 178600 }) },
  { id: "r25-scale-tech", customer: "Scale Tech", rep: "Todd", cs: "Ayrton", tier: "B", projection: 500_000,
    months: months({ 1: 54000, 4: 117200, 6: 147400 }) },
  { id: "r25-terabiotech", customer: "Terabiotech", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 8: 22450, 11: 109820 }) },
  { id: "r25-clean-nutraceuticals", customer: "Clean Nutraceuticals", rep: "Todd", cs: "Ashley", tier: "A", projection: 4_000_000,
    months: months({ 10: 91770, 11: 198075 }) },
  { id: "r25-platinum-health", customer: "Platinum Health", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 8: 42500 }) },
  { id: "r25-no-days-wasted-labs", customer: "No Days Wasted Labs", rep: "Todd", cs: "Ashley", tier: "B", projection: 500_000,
    months: months({ 11: 92620 }) },
  { id: "r25-touchstone", customer: "Touchstone", rep: "Todd", cs: "Lindsay", tier: "B", projection: 500_000,
    months: months({ 0: 43000, 2: 94400, 3: 94348, 4: 76680, 5: 168750, 10: 72555 }) },
  { id: "r25-vimergy", customer: "Vimergy", rep: "Todd", cs: "Lindsay", tier: "B", projection: 1_000_000,
    months: months({ 2: 259800, 5: 299800, 7: 371700 }) },
  { id: "r25-gaia-herbs", customer: "Gaia Herbs", rep: "Nicole", cs: "Ashley", tier: "C", projection: 500_000,
    months: months({}) },
  { id: "r25-silver-onyx", customer: "Silver Onyx", rep: "Nicole", cs: "Ashley", tier: "A", projection: 2_000_000,
    months: months({ 8: 190290, 10: 63200 }) },
];

export const ORDERS_PORTAL_SEED_2025: OrdersPortalRow[] = SEED_ROWS_2025_RAW.map(r => ({
  ...r,
  forecasts: emptyForecasts(),
}));

/** Per-year seed lookup used by the orders store on first boot of a year. */
export function ordersPortalSeedForYear(year: number): OrdersPortalRow[] {
  if (year === 2025) return ORDERS_PORTAL_SEED_2025;
  if (year === 2026) return ORDERS_PORTAL_SEED;
  return [];
}

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
