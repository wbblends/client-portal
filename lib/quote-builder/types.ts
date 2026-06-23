/**
 * Quote Builder — shared data shape.
 *
 * One `QuoteData` object backs the whole tool: it is what the React form
 * edits, what Claude fills in from uploaded materials, and what the PDF
 * filler maps onto the real AcroForm fields of the two WB Blends quote PDFs
 * (Liquid, and Capsule/Powder). The two PDFs diverge — Liquid has a
 * tincture/syrup/carrier section while Capsule/Powder has capsule + powder
 * sections — so `QuoteData` is the *union* of both, and lib/quote-builder/
 * mappings.ts decides which fields land on which form.
 *
 * Everything is a string (or string-union) so the form, the AI, and
 * localStorage all speak the same language. Empty string = "not provided".
 */

/** Which quote form the rep is building. `capsule` and `powder` share one
 *  PDF template (capsule-powder.pdf) but surface different option sections;
 *  `liquid` is its own template. */
export type ProductType = "capsule" | "powder" | "liquid";

export const PRODUCT_TYPES: ProductType[] = ["capsule", "powder", "liquid"];

/** yes / no / unanswered. */
export type YesNo = "yes" | "no" | "";

/** A single composition row. Not every column applies to every form:
 *  Capsule/Powder uses name + assay + labelClaim + overage + pctFormula;
 *  Liquid uses name + assay + labelClaim + potencyAdj + overage + gServ +
 *  mgServ. Unused columns stay blank. */
export type Ingredient = {
  name: string;
  /** Assay / potency of the raw material (e.g. "10:1", "98%"). */
  assay: string;
  /** Label claim — mg on Capsule/Powder, grams on Liquid. */
  labelClaim: string;
  /** Potency-adjusted amount (Liquid only). */
  potencyAdj: string;
  overage: string;
  /** Liquid only — grams per serving. */
  gServ: string;
  /** Liquid only — mg per serving. */
  mgServ: string;
  /** Capsule/Powder only — % of formula. */
  pctFormula: string;
};

export function emptyIngredient(): Ingredient {
  return {
    name: "",
    assay: "",
    labelClaim: "",
    potencyAdj: "",
    overage: "",
    gServ: "",
    mgServ: "",
    pctFormula: "",
  };
}

/** Single-select option columns (powder flavor / sweetener / color). */
export type FlavorChoice = "natural" | "artificial" | "nat_art" | "tbd" | "";

export type QuoteData = {
  productType: ProductType;

  // ── Contact ──
  brand: string;
  product: string;
  contact: string;
  email: string;

  // ── Composition ──
  ingredients: Ingredient[];

  // ── Product background ──
  newProduct: YesNo;
  flexFirm: string;
  sample: YesNo;
  prodSpecs: YesNo;
  excipientRestrictions: YesNo;
  /** Capsule/Powder preferred excipient — single-select (the PDF field is one
   *  radio group, so only one can be chosen). */
  preferredExcipient: "mcc" | "sio2" | "rice" | "bamboo" | "other" | "none" | "";
  excipientOther: string;

  // ── Project details ──
  timeline: string;
  avenues: string;
  targetPrice: string;
  msrp: string;

  // ── Volume ──
  vol1: string;
  vol2: string;
  vol3: string;
  annualVolume: string;
  servingsPerBottle: string;
  servingSize: string;

  // ── Capsule options ──
  capVeg: boolean;
  capGelatin: boolean;
  capOrganic: boolean;
  capOther: string;
  capMfg: boolean;
  /** Capsule sizes — independent checkboxes on the PDF. */
  capSize00el: boolean;
  capSize00: boolean;
  capSize0: boolean;
  capSize1: boolean;
  capSizeOther: string;
  capSizeMfg: boolean;
  coloredCapsule: YesNo;
  capColor: string;

  // ── Powder options ──
  powderFlavor: string;
  flavorType: FlavorChoice;
  sweetener: FlavorChoice;
  colored: FlavorChoice;

  // ── Liquid options ──
  liquidType: "tincture" | "syrup" | "suspension" | "oil" | "other" | "";
  liquidTypeOther: string;
  herbStrength: string;
  preservatives: string;
  preferredPreservatives: string;
  carrierGlycerin: string;
  carrierAlcohol: string;
  carrierWater: string;
  carrierOtherName: string;
  carrierOtherPct: string;
  macerations: string;
  macerationMfg: boolean;

  // ── Packaging ──
  pkgJar: boolean;
  pkgBottle: boolean;
  pkgBag: boolean;
  pkgBulk: boolean;
  pkgStick: boolean;
  pkgSachet: boolean;
  pkgTbd: boolean;

  matHdpe: boolean;
  matPet: boolean;
  matGlass: boolean;
  matOther: string;
  matMfg: boolean;

  colorWhite: boolean;
  colorBlack: boolean;
  colorAmber: boolean;
  colorCobalt: boolean;
  colorOther: string;
  colorMfg: boolean;

  /** Lid type — Capsule/Powder: smooth | ribbed | other.
   *  Liquid: dropper | phenolic | other. */
  lidType: "smooth" | "ribbed" | "dropper" | "phenolic" | "other" | "";
  lidTypeOther: string;
  lidColor: "white" | "black" | "other" | "";
  lidColorOther: string;

  labelSource: "wb" | "cust" | "";
  /** Capsule/Powder scoop. */
  scoop: "none" | "regular" | "funnel" | "";

  packOut: "standard" | "custom" | "";
  boxSize: string;
  unitsPerCarton: string;
  palletQty: string;
  bottleSize: string;
  lidSize: string;

  // ── Accessories (capsule only) ──
  cotton: YesNo;
  desiccant: YesNo;
  unitCartonCust: YesNo;
  insertCust: YesNo;

  // ── Special requirements ──
  srOrganic: boolean;
  srNonGmo: boolean;
  srNonGmoProject: boolean;
  srGlutenFree: boolean;
  srBscgNsf: boolean;
  srVegan: boolean;
  srProp65: boolean;
  srAllergenFree: boolean;
  srRawMaterialClaims: boolean;
  srRetailers: boolean;
  srMicrobial: boolean;
  srCofA: boolean;
  srHeavyMetal: boolean;
  srOther: string;

  international: YesNo;
  intlCountries: string;
};

/** A blank quote, used as the form's initial state and as the merge base for
 *  AI-extracted values. `ingredients` starts with a handful of empty rows so
 *  the composition table renders immediately. */
export function emptyQuoteData(productType: ProductType = "capsule"): QuoteData {
  return {
    productType,
    brand: "",
    product: "",
    contact: "",
    email: "",
    ingredients: Array.from({ length: 5 }, emptyIngredient),
    newProduct: "",
    flexFirm: "",
    sample: "",
    prodSpecs: "",
    excipientRestrictions: "",
    preferredExcipient: "",
    excipientOther: "",
    timeline: "",
    avenues: "",
    targetPrice: "",
    msrp: "",
    vol1: "",
    vol2: "",
    vol3: "",
    annualVolume: "",
    servingsPerBottle: "",
    servingSize: "",
    capVeg: false,
    capGelatin: false,
    capOrganic: false,
    capOther: "",
    capMfg: false,
    capSize00el: false,
    capSize00: false,
    capSize0: false,
    capSize1: false,
    capSizeOther: "",
    capSizeMfg: false,
    coloredCapsule: "",
    capColor: "",
    powderFlavor: "",
    flavorType: "",
    sweetener: "",
    colored: "",
    liquidType: "",
    liquidTypeOther: "",
    herbStrength: "",
    preservatives: "",
    preferredPreservatives: "",
    carrierGlycerin: "",
    carrierAlcohol: "",
    carrierWater: "",
    carrierOtherName: "",
    carrierOtherPct: "",
    macerations: "",
    macerationMfg: false,
    pkgJar: false,
    pkgBottle: false,
    pkgBag: false,
    pkgBulk: false,
    pkgStick: false,
    pkgSachet: false,
    pkgTbd: false,
    matHdpe: false,
    matPet: false,
    matGlass: false,
    matOther: "",
    matMfg: false,
    colorWhite: false,
    colorBlack: false,
    colorAmber: false,
    colorCobalt: false,
    colorOther: "",
    colorMfg: false,
    lidType: "",
    lidTypeOther: "",
    lidColor: "",
    lidColorOther: "",
    labelSource: "",
    scoop: "",
    packOut: "",
    boxSize: "",
    unitsPerCarton: "",
    palletQty: "",
    bottleSize: "",
    lidSize: "",
    cotton: "",
    desiccant: "",
    unitCartonCust: "",
    insertCust: "",
    srOrganic: false,
    srNonGmo: false,
    srNonGmoProject: false,
    srGlutenFree: false,
    srBscgNsf: false,
    srVegan: false,
    srProp65: false,
    srAllergenFree: false,
    srRawMaterialClaims: false,
    srRetailers: false,
    srMicrobial: false,
    srCofA: false,
    srHeavyMetal: false,
    srOther: "",
    international: "",
    intlCountries: "",
  };
}

/** Template file (under lib/quote-builder/templates/) for a product type. */
export function templateFileFor(productType: ProductType): string {
  return productType === "liquid" ? "liquid.pdf" : "capsule-powder.pdf";
}
