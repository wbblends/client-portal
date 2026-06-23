/**
 * Quote Builder — PDF filler.
 *
 * Takes a `QuoteData` object and stamps it onto the real AcroForm fields of
 * the matching WB Blends quote PDF (Liquid, or Capsule/Powder). The field
 * names + on-states here were reverse-engineered directly from the two
 * template PDFs in ./templates (read with pdf-lib + a reading-order text
 * dump), so they map to the *visual* columns/labels, not the sometimes-
 * misleading internal field names. Two quirks worth calling out:
 *
 *   • Capsule/Powder composition: the "Assay" column is the field
 *     `Label Claim GRow{n}` and the "Label Claim (mg)" column is the field
 *     `Potency AdjRow{n}` — i.e. those two field names are swapped relative
 *     to their on-page meaning. Verified by x-coordinate.
 *   • Several yes/no questions are single AcroForm fields with two widgets
 *     whose export states are `/1` and `/2` (and a few `/3`). Polarity is not
 *     uniform: most are yes=1/no=2, but `q7` (colored capsule) and `q6`
 *     (international) are yes=2/no=1. See the per-form builders below.
 *
 * Obscure "Customer supplied Y/N" accessory toggles (X#, w#, e3…, XX) on the
 * packaging page are intentionally left untouched — they're ambiguous and a
 * rep reviews the PDF before sending, so a wrong check would be worse than a
 * blank.
 */
import { PDFDocument, PDFName, PDFCheckBox, PDFBool, PDFDict } from "pdf-lib";
import type { QuoteData, ProductType, Ingredient } from "./types";

/** One fill instruction. */
type Op =
  | { kind: "text"; field: string; value: string }
  | { kind: "check"; field: string } // simple /On checkbox
  | { kind: "radio"; field: string; state: string }; // multi-state field → set V + AS

// ── low-level pdf-lib helpers ───────────────────────────────────────────────

function setText(doc: PDFForm, field: string, value: string) {
  if (!value) return;
  try {
    doc.getTextField(field).setText(value);
  } catch {
    /* field missing on this template — skip silently */
  }
}

function check(doc: PDFForm, field: string) {
  try {
    const f = doc.getField(field);
    if (f instanceof PDFCheckBox) f.check();
  } catch {
    /* skip */
  }
}

/** Set a multi-state field (a "checkbox" the PDF author wired as two/three
 *  widgets with export states like /1, /2, /3) to one specific state. pdf-lib
 *  has no high-level API for this, so we set the field value `/V` and each
 *  widget's appearance state `/AS` by hand. */
function setRadio(doc: PDFForm, field: string, state: string) {
  try {
    const f = doc.getField(field);
    const acro = f.acroField;
    acro.dict.set(PDFName.of("V"), PDFName.of(state));
    for (const w of acro.getWidgets()) {
      const ap = w.dict.lookup(PDFName.of("AP"));
      let hasState = false;
      if (ap instanceof PDFDict) {
        const normal = ap.lookup(PDFName.of("N"));
        if (normal instanceof PDFDict) hasState = normal.has(PDFName.of(state));
      }
      w.dict.set(PDFName.of("AS"), PDFName.of(hasState ? state : "Off"));
    }
  } catch {
    /* skip */
  }
}

type PDFForm = ReturnType<PDFDocument["getForm"]>;

function applyOps(form: PDFForm, ops: Op[]) {
  for (const op of ops) {
    if (op.kind === "text") setText(form, op.field, op.value);
    else if (op.kind === "check") check(form, op.field);
    else setRadio(form, op.field, op.state);
  }
}

// ── op-builder sugar ────────────────────────────────────────────────────────

const t = (field: string, value: string): Op => ({ kind: "text", field, value });
const c = (field: string): Op => ({ kind: "check", field });
const r = (field: string, state: string): Op => ({ kind: "radio", field, state });
const yn = (field: string, v: string, yes: string, no: string): Op | null =>
  v === "yes" ? r(field, yes) : v === "no" ? r(field, no) : null;

// ── shared sections (identical field names on both templates) ───────────────

function contactOps(d: QuoteData): Op[] {
  return [
    t("Legal Brand Name", d.brand),
    t("Product Name", d.product),
    t("Primary Contact Name", d.contact),
    t("Email", d.email),
  ];
}

function projectVolumeOps(d: QuoteData): Op[] {
  return [
    t("What is your timeline for this project", d.timeline),
    t("What are your selling Avenues", d.avenues),
    t("Target price", d.targetPrice),
    t("MSRP", d.msrp),
    t("1", d.vol1),
    t("2", d.vol2),
    t("3", d.vol3),
    t("Annual Volume", d.annualVolume),
    t("Product Count", d.servingsPerBottle),
    t("Dose Count", d.servingSize),
  ];
}

/** Special requirements + international — same field names on both forms. */
function specialReqOps(d: QuoteData): Op[] {
  const ops: Op[] = [];
  if (d.srOrganic) ops.push(c("Organic"));
  if (d.srNonGmo) ops.push(c("NonGMO"));
  if (d.srNonGmoProject) ops.push(c("NonGMO Project"));
  if (d.srGlutenFree) ops.push(c("Gluten Free"));
  if (d.srBscgNsf) ops.push(c("BSCG  NSF")); // two spaces — exact field name
  if (d.srVegan) ops.push(c("Vegan"));
  if (d.srProp65) ops.push(c("Prop 65"));
  if (d.srAllergenFree) ops.push(c("Allergen Free"));
  if (d.srRawMaterialClaims) ops.push(c("Raw Material Claims"));
  if (d.srRetailers) ops.push(c("Product is going into retailers"));
  // Microbial / C of A / heavy-metal testing have no dedicated checkbox on the
  // PDF, so they ride along in the free-text "Other" field alongside anything
  // the rep typed.
  const extras: string[] = [];
  if (d.srMicrobial) extras.push("Microbial");
  if (d.srCofA) extras.push("C of A (USP or equivalent)");
  if (d.srHeavyMetal) extras.push("Heavy Metal Testing");
  const otherText = [d.srOther.trim(), ...extras].filter(Boolean).join("; ");
  ops.push(t("undefined", otherText));
  const intl = yn("q6", d.international, "2", "1"); // international: yes=2, no=1
  if (intl) ops.push(intl);
  ops.push(t("If yes which countries", d.intlCountries));
  return ops;
}

/** Background questions shared by both forms: new product (q1) + sample (q3).
 *  The existing-product (q2) and FPS (q4) questions were dropped from the
 *  tool, so those PDF fields are left blank. */
function backgroundSharedOps(d: QuoteData): Op[] {
  const ops: (Op | null)[] = [
    yn("q1", d.newProduct, "1", "2"),
    t("If yes please send the s", d.flexFirm),
    yn("q3", d.sample, "1", "2"),
  ];
  return ops.filter((o): o is Op => o !== null);
}

function packagingSharedOps(d: QuoteData): Op[] {
  const ops: Op[] = [];
  // Container type
  if (d.pkgJar) ops.push(c("Jar"));
  if (d.pkgBottle) ops.push(c("Bottle"));
  // Material
  if (d.matHdpe) ops.push(c("HDPE"));
  if (d.matPet) ops.push(c("PET"));
  if (d.matGlass) ops.push(c("Glass"));
  if (d.matOther) ops.push(c("Other_4"), t("undefined_8", d.matOther));
  if (d.matMfg) ops.push(c("TBD_7"));
  // Bottle color
  if (d.colorWhite) ops.push(c("White"));
  if (d.colorBlack) ops.push(c("Black"));
  if (d.colorAmber) ops.push(c("Dark Amber"));
  if (d.colorCobalt) ops.push(c("Cobalt Blue"));
  if (d.colorOther) ops.push(c("Other_5"), t("undefined_8cd", d.colorOther));
  // Lid color (e5 radio: white=1, black=3, other=2)
  if (d.lidColor === "white") ops.push(r("e5", "1"));
  else if (d.lidColor === "black") ops.push(r("e5", "3"));
  else if (d.lidColor === "other")
    ops.push(r("e5", "2"), t("undefined_8vfc", d.lidColorOther));
  // Label source (e1: wb=1, cust=2)
  if (d.labelSource === "wb") ops.push(r("e1", "1"));
  else if (d.labelSource === "cust") ops.push(r("e1", "2"));
  // Pack out (e2: standard=1, custom=2)
  if (d.packOut === "standard") ops.push(r("e2", "1"));
  else if (d.packOut === "custom") ops.push(r("e2", "2"));
  // Box size + pallet qty are filled per-form (capsule/powder only — they were
  // dropped from the liquid quote), so they're not added here.
  return ops;
}

function compositionOps(d: QuoteData, productType: ProductType): Op[] {
  const ops: Op[] = [];
  const maxRows = productType === "liquid" ? 11 : 10;
  d.ingredients.slice(0, maxRows).forEach((ing: Ingredient, i) => {
    const n = i + 1;
    ops.push(t(`IngredientRow${n}`, ing.name));
    if (productType === "liquid") {
      // 7 cols: Ingredient | Assay(k) | LabelClaim(G) | PotencyAdj | Overage | InputG/Serv(i) | InputMG/Serv
      ops.push(
        t(`k${n}`, ing.assay),
        t(`Label Claim GRow${n}`, ing.labelClaim),
        t(`Potency AdjRow${n}`, ing.potencyAdj),
        t(`OverageRow${n}`, ing.overage),
        t(`i${n}`, ing.gServ),
        t(`Raw Material amountRow${n}`, ing.mgServ),
      );
    } else {
      // 5 cols: Ingredient | Assay | LabelClaim(mg) | Overage | %formula
      // NB: field names are swapped vs. visual columns (see file header).
      ops.push(
        t(`Label Claim GRow${n}`, ing.assay),
        t(`Potency AdjRow${n}`, ing.labelClaim),
        t(`OverageRow${n}`, ing.overage),
        t(`Raw Material amountRow${n}`, ing.pctFormula),
      );
    }
  });
  return ops;
}

// ── Capsule / Powder form ───────────────────────────────────────────────────

function capsulePowderOps(d: QuoteData): Op[] {
  const ops: Op[] = [
    ...contactOps(d),
    ...compositionOps(d, d.productType),
    ...backgroundSharedOps(d),
  ];

  // q3x = Excipient Restrictions, q5 = production specs
  const exc = yn("q3x", d.excipientRestrictions, "1", "2");
  if (exc) ops.push(exc);
  const ps = yn("q5", d.prodSpecs, "1", "2");
  if (ps) ops.push(ps);

  // Preferred excipient — single-select radio q4x (1=MCC,2=SiO2,3=Rice,4=Bamboo,5=Other,6=None)
  const exMap: Record<string, string> = {
    mcc: "1",
    sio2: "2",
    rice: "3",
    bamboo: "4",
    other: "5",
    none: "6",
  };
  if (d.preferredExcipient && exMap[d.preferredExcipient])
    ops.push(r("q4x", exMap[d.preferredExcipient]));
  if (d.preferredExcipient === "other")
    ops.push(t("If yes please senscs", d.excipientOther));

  ops.push(...projectVolumeOps(d));

  // Capsule options
  if (d.capVeg) ops.push(c("Vegetarian"));
  if (d.capGelatin) ops.push(c("Gelatin"));
  if (d.capOrganic) ops.push(c("Organic_2"));
  if (d.capOther) ops.push(c("Other_2"), t("undefined_4", d.capOther));
  if (d.capMfg) ops.push(c("TBD"));
  if (d.capSize00el) ops.push(c("00EL"));
  if (d.capSize00) ops.push(c("00"));
  if (d.capSize0) ops.push(c("0"));
  if (d.capSize1) ops.push(c("cd")); // size "1" → field "cd"
  if (d.capSizeOther) ops.push(c("Other_3"), t("undefined_5", d.capSizeOther));
  if (d.capSizeMfg) ops.push(c("TBD_2"));
  const cc = yn("q7", d.coloredCapsule, "2", "1"); // colored capsule: yes=2, no=1
  if (cc) ops.push(cc);
  ops.push(t("Color_2", d.capColor));

  // Powder options
  ops.push(t("Powder Flavor", d.powderFlavor));
  const flavorMap: Record<string, string> = {
    natural: "Natural",
    artificial: "toggle_38",
    nat_art: "toggle_35",
    tbd: "TBD_3",
  };
  const sweetMap: Record<string, string> = {
    natural: "Natural_2",
    artificial: "TBD_4",
    nat_art: "toggle_36",
    tbd: "toggle_39",
  };
  const colorMap: Record<string, string> = {
    natural: "Natural_3",
    artificial: "toggle_40",
    nat_art: "toggle_37",
    tbd: "TBD_5",
  };
  if (d.flavorType && flavorMap[d.flavorType]) ops.push(c(flavorMap[d.flavorType]));
  if (d.sweetener && sweetMap[d.sweetener]) ops.push(c(sweetMap[d.sweetener]));
  if (d.colored && colorMap[d.colored]) ops.push(c(colorMap[d.colored]));

  // Packaging — capsule/powder has extra container types + lid type + scoop
  if (d.pkgBag) ops.push(c("Bag"));
  if (d.pkgBulk) ops.push(c("Bulk Powder"));
  if (d.pkgStick) ops.push(c("Stick Pack"));
  if (d.pkgSachet) ops.push(c("Sachet"));
  if (d.pkgTbd) ops.push(c("TBD_6"));
  if (d.colorMfg) ops.push(c("TBD_8"));
  // Lid type: smooth/ribbed/other
  if (d.lidType === "smooth") ops.push(c("Smooth"));
  else if (d.lidType === "ribbed") ops.push(c("Ribbed"));
  else if (d.lidType === "other")
    ops.push(c("Other_6"), t("undefined_8vf", d.lidTypeOther));
  // Scoop (e4: none=1, regular=2, funnel=3)
  if (d.scoop === "none") ops.push(r("e4", "1"));
  else if (d.scoop === "regular") ops.push(r("e4", "2"));
  else if (d.scoop === "funnel") ops.push(r("e4", "3"));
  // Sizes specific to capsule/powder
  ops.push(
    t("Case Label", d.boxSize),
    t("Pallet Size", d.palletQty),
    t("undefinecd_cd", d.unitsPerCarton),
    t("undefinecd_cdcd", d.lidSize),
  );

  // Accessory Y/N toggles — capsule only (mapped to the packaging-page fields;
  // all are yes=/2, no=/1).
  if (d.productType === "capsule") {
    const acc: (Op | null)[] = [
      yn("w1", d.cotton, "2", "1"), // Cotton
      yn("w2", d.desiccant, "2", "1"), // Desiccant
      yn("q10", d.unitCartonCust, "2", "1"), // Unit carton — customer supplied
      yn("w5", d.insertCust, "2", "1"), // Insert — customer supplied
    ];
    for (const o of acc) if (o) ops.push(o);
  }

  ops.push(...packagingSharedOps(d));
  ops.push(...specialReqOps(d));
  return ops;
}

// ── Liquid form ─────────────────────────────────────────────────────────────

function liquidOps(d: QuoteData): Op[] {
  const ops: Op[] = [
    ...contactOps(d),
    ...compositionOps(d, "liquid"),
    ...backgroundSharedOps(d),
  ];

  // Liquid q5 = production specs (no q3x/q4x on the liquid form)
  const ps = yn("q5", d.prodSpecs, "1", "2");
  if (ps) ops.push(ps);

  ops.push(...projectVolumeOps(d));

  // Liquid type (reuses capsule checkbox field names)
  if (d.liquidType === "tincture") ops.push(c("Vegetarian"));
  else if (d.liquidType === "syrup") ops.push(c("Gelatin"));
  else if (d.liquidType === "suspension") ops.push(c("Organic_2"));
  else if (d.liquidType === "oil") ops.push(c("Other_2"));
  else if (d.liquidType === "other")
    ops.push(c("TBD"), t("undefined_4", d.liquidTypeOther));
  ops.push(
    t("undefined_5", d.herbStrength),
    t("Color_2", d.preservatives),
    t("Preferred Excipients", d.preferredPreservatives),
    t("n1", d.carrierGlycerin),
    t("n2", d.carrierAlcohol),
    t("n3", d.carrierWater),
    t("n4", d.carrierOtherName),
    t("n5", d.carrierOtherPct),
    t("Preferred Excipie", d.macerations),
  );
  if (d.macerationMfg) ops.push(c("TBD_5"));

  // Packaging — liquid: Jar / Bottle / TBD(=field "Bag")
  if (d.pkgTbd) ops.push(c("Bag"));
  // Lid type: dropper/phenolic/other (e4: 1/2/3)
  if (d.lidType === "dropper") ops.push(r("e4", "1"));
  else if (d.lidType === "phenolic") ops.push(r("e4", "2"));
  else if (d.lidType === "other")
    ops.push(r("e4", "3"), t("undefinecd_cd", d.lidTypeOther));

  ops.push(...packagingSharedOps(d));
  ops.push(...specialReqOps(d));
  return ops;
}

// ── public entrypoint ───────────────────────────────────────────────────────

/**
 * Fill the matching template PDF and return the finished bytes. `template` is
 * the raw bytes of liquid.pdf or capsule-powder.pdf (the API route reads it
 * off disk). The result keeps its form fields editable so a rep can still
 * tweak the PDF in any viewer; appearances are refreshed so values show.
 */
export async function fillQuotePdf(
  template: Uint8Array | ArrayBuffer,
  data: QuoteData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(template, { ignoreEncryption: true });
  const form = doc.getForm();
  const ops =
    data.productType === "liquid" ? liquidOps(data) : capsulePowderOps(data);
  applyOps(form, ops);
  // Some viewers won't render programmatic AS changes without NeedAppearances.
  try {
    form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);
  } catch {
    /* non-fatal */
  }
  return doc.save({ updateFieldAppearances: true });
}
