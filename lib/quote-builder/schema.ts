/**
 * Quote Builder — Claude tool schema.
 *
 * The analyze endpoint forces Claude to call `submit_quote` exactly once; its
 * arguments are validated against this JSON schema at the API layer, so the
 * route gets back a well-shaped object instead of free text it has to parse.
 * Keys mirror `QuoteData` (lib/quote-builder/types.ts) so merging is a plain
 * object spread.
 */
import type Anthropic from "@anthropic-ai/sdk";

const yesNo = { type: "string", enum: ["yes", "no", ""] } as const;
const flavor = {
  type: "string",
  enum: ["natural", "artificial", "nat_art", "tbd", ""],
} as const;
const bool = { type: "boolean" } as const;
const str = { type: "string" } as const;

export const SUBMIT_QUOTE_TOOL: Anthropic.Tool = {
  name: "submit_quote",
  description:
    "Record everything you could determine about this manufacturing quote request from the uploaded materials. Fill every field you have evidence for; leave anything you're unsure about as an empty string / false. Never invent values.",
  input_schema: {
    type: "object",
    properties: {
      detectedProductType: {
        type: "string",
        enum: ["capsule", "powder", "liquid"],
        description:
          "Best guess at the product format from the materials. Capsules and tablets → capsule; drink mixes / loose powders → powder; tinctures, syrups, suspensions, oils → liquid.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Your confidence in the extracted values overall.",
      },
      summary: {
        type: "string",
        description:
          "2–4 sentence plain-English summary of what the materials describe and what you filled in, for the rep to sanity-check. Mention anything ambiguous or missing.",
      },
      fields: {
        type: "object",
        description: "Extracted quote fields. Keys mirror the form.",
        properties: {
          brand: str,
          product: str,
          contact: str,
          email: str,
          ingredients: {
            type: "array",
            description:
              "Composition / formula rows in label order. Include assay (raw material potency/ratio like '10:1' or '98%'), labelClaim (amount per serving — mg for capsule/powder, grams for liquid), overage, and for capsule/powder pctFormula, for liquid potencyAdj/gServ/mgServ when known.",
            items: {
              type: "object",
              properties: {
                name: str,
                assay: str,
                labelClaim: str,
                potencyAdj: str,
                overage: str,
                gServ: str,
                mgServ: str,
                pctFormula: str,
              },
              required: ["name"],
            },
          },
          newProduct: yesNo,
          flexFirm: str,
          existingProduct: yesNo,
          existingInfo: str,
          sample: yesNo,
          fps: yesNo,
          prodSpecs: yesNo,
          excipientRestrictions: yesNo,
          preferredExcipient: {
            type: "string",
            enum: ["mcc", "sio2", "rice", "bamboo", "other", "none", ""],
          },
          excipientOther: str,
          timeline: str,
          avenues: str,
          targetPrice: str,
          msrp: str,
          vol1: str,
          vol2: str,
          vol3: str,
          annualVolume: str,
          servingsPerBottle: str,
          servingSize: str,
          // Capsule
          capVeg: bool,
          capGelatin: bool,
          capOrganic: bool,
          capOther: str,
          capSize00el: bool,
          capSize00: bool,
          capSize0: bool,
          capSize1: bool,
          coloredCapsule: yesNo,
          capColor: str,
          // Powder
          powderFlavor: str,
          flavorType: flavor,
          sweetener: flavor,
          colored: flavor,
          // Liquid
          liquidType: {
            type: "string",
            enum: ["tincture", "syrup", "suspension", "oil", "other", ""],
          },
          liquidTypeOther: str,
          herbStrength: str,
          preservatives: str,
          preferredPreservatives: str,
          carrierGlycerin: str,
          carrierAlcohol: str,
          carrierWater: str,
          carrierOtherName: str,
          carrierOtherPct: str,
          macerations: str,
          // Packaging
          pkgJar: bool,
          pkgBottle: bool,
          pkgBag: bool,
          pkgBulk: bool,
          pkgStick: bool,
          pkgSachet: bool,
          matHdpe: bool,
          matPet: bool,
          matGlass: bool,
          matOther: str,
          colorWhite: bool,
          colorBlack: bool,
          colorAmber: bool,
          colorCobalt: bool,
          colorOther: str,
          lidType: {
            type: "string",
            enum: ["smooth", "ribbed", "dropper", "phenolic", "other", ""],
          },
          lidColor: { type: "string", enum: ["white", "black", "other", ""] },
          labelSource: { type: "string", enum: ["wb", "cust", ""] },
          scoop: { type: "string", enum: ["none", "regular", "funnel", ""] },
          packOut: { type: "string", enum: ["standard", "custom", ""] },
          boxSize: str,
          unitsPerCarton: str,
          palletQty: str,
          // Special requirements
          srOrganic: bool,
          srNonGmo: bool,
          srNonGmoProject: bool,
          srGlutenFree: bool,
          srBscgNsf: bool,
          srVegan: bool,
          srProp65: bool,
          srAllergenFree: bool,
          srRawMaterialClaims: bool,
          srRetailers: bool,
          srOther: str,
          international: yesNo,
          intlCountries: str,
        },
      },
    },
    required: ["detectedProductType", "summary", "fields"],
  },
};
