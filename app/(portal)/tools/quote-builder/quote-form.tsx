"use client";

/**
 * Quote Builder — the editable, pre-filled form (the review step).
 *
 * Sections mirror the WB Blends quote PDFs and switch on product type:
 * capsule and powder share most fields but each shows its own options block;
 * liquid swaps in the tincture/carrier section. Everything here is a
 * controlled input over a single QuoteData object owned by the parent.
 */
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  emptyIngredient,
  type QuoteData,
  type Ingredient,
  type ProductType,
} from "@/lib/quote-builder/types";

type Props = {
  data: QuoteData;
  set: <K extends keyof QuoteData>(key: K, value: QuoteData[K]) => void;
  setIngredient: (i: number, key: keyof Ingredient, value: string) => void;
  setIngredients: (rows: Ingredient[]) => void;
};

// ─── Field primitives ───────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 border-b border-border/70 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          {title}
        </h3>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold text-muted">{children}</span>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-soft focus:border-primary focus:bg-card"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
        checked
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-surface text-foreground-soft hover:border-border-strong",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="leading-tight">{label}</span>
    </label>
  );
}

function YesNo({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: "yes" | "no" | "";
  onChange: (v: "yes" | "no") => void;
  note?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        {(["yes", "no"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "h-10 flex-1 rounded-xl border text-sm font-semibold capitalize transition-colors",
              value === opt
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-foreground-soft hover:border-border-strong",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {note && <p className="mt-1.5 text-xs text-muted-soft">{note}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "h-9 rounded-lg border px-3 text-sm font-medium transition-colors",
              value === o.v
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-foreground-soft hover:border-border-strong",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const FLAVOR_OPTS = [
  { v: "natural" as const, label: "Natural" },
  { v: "artificial" as const, label: "Artificial" },
  { v: "nat_art" as const, label: "Nat. & Art." },
  { v: "tbd" as const, label: "TBD" },
];

// ─── Composition table ──────────────────────────────────────────────────────

function Composition({ data, setIngredient, setIngredients }: Props) {
  const liquid = data.productType === "liquid";
  const cols = liquid
    ? ["Ingredient", "Assay", "Label Claim (g)", "Potency Adj.", "Overage", "g/Serv", "mg/Serv"]
    : ["Ingredient", "Assay", "Label Claim (mg)", "Overage", "% of Formula"];
  const keys: (keyof Ingredient)[] = liquid
    ? ["name", "assay", "labelClaim", "potencyAdj", "overage", "gServ", "mgServ"]
    : ["name", "assay", "labelClaim", "overage", "pctFormula"];

  return (
    <Section title="Composition" hint="Add each ingredient in label order. The AI fills this from specs and formulas when it can.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="px-1.5 pb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-soft"
                >
                  {c}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {data.ingredients.map((ing, i) => (
              <tr key={i} className="group">
                {keys.map((k) => (
                  <td key={k} className="p-0.5">
                    <input
                      type="text"
                      value={ing[k]}
                      onChange={(e) => setIngredient(i, k, e.target.value)}
                      className={cn(
                        "h-9 w-full rounded-lg border border-transparent bg-surface px-2 text-sm text-foreground outline-none transition-colors hover:border-border focus:border-primary focus:bg-card",
                        k === "name" ? "min-w-[160px]" : "min-w-[70px]",
                      )}
                    />
                  </td>
                ))}
                <td className="p-0.5 text-center">
                  {data.ingredients.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() =>
                        setIngredients(data.ingredients.filter((_, j) => j !== i))
                      }
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-soft opacity-0 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setIngredients([...data.ingredients, emptyIngredient()])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground-soft transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> Add ingredient
      </button>
    </Section>
  );
}

// ─── Main form ──────────────────────────────────────────────────────────────

export function QuoteForm(props: Props) {
  const { data, set } = props;
  const isCapsule = data.productType === "capsule";
  const isPowder = data.productType === "powder";
  const isLiquid = data.productType === "liquid";

  return (
    <div className="flex flex-col gap-4">
      {/* Contact */}
      <Section title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Legal brand name" value={data.brand} onChange={(v) => set("brand", v)} />
          <Text label="Product name" value={data.product} onChange={(v) => set("product", v)} />
          <Text label="Primary contact name" value={data.contact} onChange={(v) => set("contact", v)} />
          <Text label="Email" value={data.email} onChange={(v) => set("email", v)} />
        </div>
      </Section>

      <Composition {...props} />

      {/* Background */}
      <Section title="Product background">
        <div className="grid gap-5 sm:grid-cols-2">
          <YesNo label="Is this a new product?" value={data.newProduct} onChange={(v) => set("newProduct", v)} />
          {data.newProduct === "yes" && (
            <Text label="Formulation — flexible or firm?" value={data.flexFirm} onChange={(v) => set("flexFirm", v)} placeholder="e.g. Flexible" />
          )}
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <YesNo label="Can we order a sample of the finished product?" value={data.sample} onChange={(v) => set("sample", v)} note="If yes → Attn: Landon Penrod, 585 W 1000N, Spanish Fork, UT 84660" />
          <YesNo label="Specific production specifications?" value={data.prodSpecs} onChange={(v) => set("prodSpecs", v)} note="If yes, attach manufacturing specs." />
          {!isLiquid && (
            <YesNo label="Excipient restrictions?" value={data.excipientRestrictions} onChange={(v) => set("excipientRestrictions", v)} />
          )}
        </div>
        {!isLiquid && (
          <div className="mt-5">
            <Segmented
              label="Preferred excipient"
              value={data.preferredExcipient}
              onChange={(v) => set("preferredExcipient", v)}
              options={[
                { v: "mcc", label: "Microcrystalline Cellulose" },
                { v: "sio2", label: "Silicon Dioxide" },
                { v: "rice", label: "Rice Flour" },
                { v: "bamboo", label: "Bamboo Extract (70% Silica)" },
                { v: "other", label: "Other" },
                { v: "none", label: "No Excipients" },
              ]}
            />
            {data.preferredExcipient === "other" && (
              <div className="mt-3 max-w-sm">
                <Text label="Other excipient" value={data.excipientOther} onChange={(v) => set("excipientOther", v)} />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Project + Volume */}
      <Section title="Project details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Timeline" value={data.timeline} onChange={(v) => set("timeline", v)} placeholder="e.g. Q3 2026" />
          <Text label="Selling avenues" value={data.avenues} onChange={(v) => set("avenues", v)} placeholder="Amazon, DTC, Retail" />
          <Text label="Target price" value={data.targetPrice} onChange={(v) => set("targetPrice", v)} placeholder="$" />
          <Text label="MSRP" value={data.msrp} onChange={(v) => set("msrp", v)} placeholder="$" />
        </div>
      </Section>

      <Section title="Volume" hint="Quantity tiers you'd like quoted (MOQ).">
        <div className="grid gap-4 sm:grid-cols-3">
          <Text label="Tier 1" value={data.vol1} onChange={(v) => set("vol1", v)} />
          <Text label="Tier 2" value={data.vol2} onChange={(v) => set("vol2", v)} />
          <Text label="Tier 3" value={data.vol3} onChange={(v) => set("vol3", v)} />
          <Text label="Annual volume" value={data.annualVolume} onChange={(v) => set("annualVolume", v)} />
          <Text label="Servings per bottle" value={data.servingsPerBottle} onChange={(v) => set("servingsPerBottle", v)} />
          <Text label="Serving size" value={data.servingSize} onChange={(v) => set("servingSize", v)} />
        </div>
      </Section>

      {/* Capsule options */}
      {isCapsule && (
        <Section title="Capsule options">
          <Label>Capsule type</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <Check label="Vegetarian" checked={data.capVeg} onChange={(v) => set("capVeg", v)} />
            <Check label="Gelatin" checked={data.capGelatin} onChange={(v) => set("capGelatin", v)} />
            <Check label="Organic" checked={data.capOrganic} onChange={(v) => set("capOrganic", v)} />
            <Check label="MFG. Recommendation" checked={data.capMfg} onChange={(v) => set("capMfg", v)} />
          </div>
          <div className="mt-2 max-w-sm">
            <Text label="Other capsule type" value={data.capOther} onChange={(v) => set("capOther", v)} />
          </div>
          <div className="mt-5">
            <Label>Capsule size</Label>
            <div className="grid gap-2 sm:grid-cols-4">
              <Check label="00EL" checked={data.capSize00el} onChange={(v) => set("capSize00el", v)} />
              <Check label="00" checked={data.capSize00} onChange={(v) => set("capSize00", v)} />
              <Check label="0" checked={data.capSize0} onChange={(v) => set("capSize0", v)} />
              <Check label="1" checked={data.capSize1} onChange={(v) => set("capSize1", v)} />
              <Check label="MFG. Recommendation" checked={data.capSizeMfg} onChange={(v) => set("capSizeMfg", v)} />
            </div>
            <div className="mt-2 max-w-sm">
              <Text label="Other size" value={data.capSizeOther} onChange={(v) => set("capSizeOther", v)} />
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <YesNo label="Colored capsule?" value={data.coloredCapsule} onChange={(v) => set("coloredCapsule", v)} />
            {data.coloredCapsule === "yes" && (
              <Text label="Color" value={data.capColor} onChange={(v) => set("capColor", v)} />
            )}
          </div>
        </Section>
      )}

      {/* Powder options */}
      {isPowder && (
        <Section title="Powder options">
          <div className="max-w-sm">
            <Text label="Powder flavor" value={data.powderFlavor} onChange={(v) => set("powderFlavor", v)} />
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <Segmented label="Flavor type" value={data.flavorType} onChange={(v) => set("flavorType", v)} options={FLAVOR_OPTS} />
            <Segmented label="Sweetener" value={data.sweetener} onChange={(v) => set("sweetener", v)} options={FLAVOR_OPTS} />
            <Segmented label="Colored" value={data.colored} onChange={(v) => set("colored", v)} options={FLAVOR_OPTS} />
          </div>
        </Section>
      )}

      {/* Liquid options */}
      {isLiquid && (
        <Section title="Liquid options">
          <Segmented
            label="Liquid type"
            value={data.liquidType}
            onChange={(v) => set("liquidType", v)}
            options={[
              { v: "tincture", label: "Tincture" },
              { v: "syrup", label: "Syrup" },
              { v: "suspension", label: "Suspension" },
              { v: "oil", label: "Oil" },
              { v: "other", label: "Other" },
            ]}
          />
          {data.liquidType === "other" && (
            <div className="mt-2 max-w-sm">
              <Text label="Other liquid type" value={data.liquidTypeOther} onChange={(v) => set("liquidTypeOther", v)} />
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Text label="Starting herb strength (tincture/syrup)" value={data.herbStrength} onChange={(v) => set("herbStrength", v)} />
            <Text label="Desired preservatives (suspension/syrup)" value={data.preservatives} onChange={(v) => set("preservatives", v)} />
            <Text label="Preferred preservatives" value={data.preferredPreservatives} onChange={(v) => set("preferredPreservatives", v)} />
            <Text label="# of macerations" value={data.macerations} onChange={(v) => set("macerations", v)} />
          </div>
          <div className="mt-5">
            <Label>Desired carriers & % of each</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Text label="Glycerin %" value={data.carrierGlycerin} onChange={(v) => set("carrierGlycerin", v)} />
              <Text label="Alcohol %" value={data.carrierAlcohol} onChange={(v) => set("carrierAlcohol", v)} />
              <Text label="Water %" value={data.carrierWater} onChange={(v) => set("carrierWater", v)} />
              <Text label="Other carrier" value={data.carrierOtherName} onChange={(v) => set("carrierOtherName", v)} />
              <Text label="Other carrier %" value={data.carrierOtherPct} onChange={(v) => set("carrierOtherPct", v)} />
            </div>
            <div className="mt-3">
              <Check label="MFG recommendation for macerations / carriers" checked={data.macerationMfg} onChange={(v) => set("macerationMfg", v)} />
            </div>
          </div>
        </Section>
      )}

      {/* Packaging */}
      <Section title="Packaging">
        <Label>Container type</Label>
        <div className="grid gap-2 sm:grid-cols-4">
          <Check label="Jar" checked={data.pkgJar} onChange={(v) => set("pkgJar", v)} />
          <Check label="Bottle" checked={data.pkgBottle} onChange={(v) => set("pkgBottle", v)} />
          {!isLiquid && <Check label="Bag" checked={data.pkgBag} onChange={(v) => set("pkgBag", v)} />}
          {!isLiquid && <Check label="Bulk" checked={data.pkgBulk} onChange={(v) => set("pkgBulk", v)} />}
          {!isLiquid && <Check label="Stick Pack" checked={data.pkgStick} onChange={(v) => set("pkgStick", v)} />}
          {!isLiquid && <Check label="Sachet" checked={data.pkgSachet} onChange={(v) => set("pkgSachet", v)} />}
          <Check label="TBD" checked={data.pkgTbd} onChange={(v) => set("pkgTbd", v)} />
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Label>Material</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check label="HDPE" checked={data.matHdpe} onChange={(v) => set("matHdpe", v)} />
              <Check label="PET" checked={data.matPet} onChange={(v) => set("matPet", v)} />
              <Check label="Glass" checked={data.matGlass} onChange={(v) => set("matGlass", v)} />
              <Check label="MFG. Rec." checked={data.matMfg} onChange={(v) => set("matMfg", v)} />
            </div>
            <div className="mt-2">
              <Text label="Other material" value={data.matOther} onChange={(v) => set("matOther", v)} />
            </div>
          </div>
          <div>
            <Label>Bottle color</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Check label="White" checked={data.colorWhite} onChange={(v) => set("colorWhite", v)} />
              <Check label="Black" checked={data.colorBlack} onChange={(v) => set("colorBlack", v)} />
              <Check label="Dark Amber" checked={data.colorAmber} onChange={(v) => set("colorAmber", v)} />
              <Check label="Cobalt Blue" checked={data.colorCobalt} onChange={(v) => set("colorCobalt", v)} />
              {!isLiquid && <Check label="MFG. Rec." checked={data.colorMfg} onChange={(v) => set("colorMfg", v)} />}
            </div>
            <div className="mt-2">
              <Text label="Other color" value={data.colorOther} onChange={(v) => set("colorOther", v)} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Segmented
            label="Lid type"
            value={data.lidType}
            onChange={(v) => set("lidType", v)}
            options={
              isLiquid
                ? [
                    { v: "dropper", label: "Dropper" },
                    { v: "phenolic", label: "Phenolic Cap" },
                    { v: "other", label: "Other" },
                  ]
                : [
                    { v: "smooth", label: "Smooth" },
                    { v: "ribbed", label: "Ribbed" },
                    { v: "other", label: "Other" },
                  ]
            }
          />
          <Segmented
            label="Lid color"
            value={data.lidColor}
            onChange={(v) => set("lidColor", v)}
            options={[
              { v: "white", label: "White" },
              { v: "black", label: "Black" },
              { v: "other", label: "Other" },
            ]}
          />
          {data.lidType === "other" && (
            <Text label="Other lid type" value={data.lidTypeOther} onChange={(v) => set("lidTypeOther", v)} />
          )}
          {data.lidColor === "other" && (
            <Text label="Other lid color" value={data.lidColorOther} onChange={(v) => set("lidColorOther", v)} />
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Segmented
            label="Label"
            value={data.labelSource}
            onChange={(v) => set("labelSource", v)}
            options={[
              { v: "wb", label: "WB Supplied" },
              { v: "cust", label: "Customer Supplied" },
            ]}
          />
          {!isLiquid && (
            <Segmented
              label="Scoop"
              value={data.scoop}
              onChange={(v) => set("scoop", v)}
              options={[
                { v: "none", label: "None" },
                { v: "regular", label: "Regular" },
                { v: "funnel", label: "With Funnel" },
              ]}
            />
          )}
          <Segmented
            label="Pack out"
            value={data.packOut}
            onChange={(v) => set("packOut", v)}
            options={[
              { v: "standard", label: "Standard (12pk)" },
              { v: "custom", label: "Custom" },
            ]}
          />
        </div>

        {/* Box size, pallet qty and the rest of the pack-out sizes were dropped
            from the liquid quote — capsule/powder only. */}
        {!isLiquid && (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Text label="Box size" value={data.boxSize} onChange={(v) => set("boxSize", v)} />
            <Text label="Units per carton" value={data.unitsPerCarton} onChange={(v) => set("unitsPerCarton", v)} />
            <Text label="Pallet quantity" value={data.palletQty} onChange={(v) => set("palletQty", v)} />
            <Text label="Lid size" value={data.lidSize} onChange={(v) => set("lidSize", v)} />
          </div>
        )}

        {/* Accessories — capsule only. */}
        {isCapsule && (
          <div className="mt-6 border-t border-border/70 pt-5">
            <Label>Accessories</Label>
            <div className="grid gap-5 sm:grid-cols-2">
              <YesNo label="Cotton" value={data.cotton} onChange={(v) => set("cotton", v)} />
              <YesNo label="Desiccant" value={data.desiccant} onChange={(v) => set("desiccant", v)} />
              <YesNo label="Unit carton — customer supplied?" value={data.unitCartonCust} onChange={(v) => set("unitCartonCust", v)} />
              <YesNo label="Insert — customer supplied?" value={data.insertCust} onChange={(v) => set("insertCust", v)} />
            </div>
          </div>
        )}
      </Section>

      {/* Special requirements */}
      <Section title="Special requirements">
        <div className="grid gap-2 sm:grid-cols-3">
          <Check label="Organic" checked={data.srOrganic} onChange={(v) => set("srOrganic", v)} />
          <Check label="Non-GMO" checked={data.srNonGmo} onChange={(v) => set("srNonGmo", v)} />
          <Check label="Non-GMO Project" checked={data.srNonGmoProject} onChange={(v) => set("srNonGmoProject", v)} />
          <Check label="Non Gluten" checked={data.srGlutenFree} onChange={(v) => set("srGlutenFree", v)} />
          <Check label="BSCG / NSF" checked={data.srBscgNsf} onChange={(v) => set("srBscgNsf", v)} />
          <Check label="Vegan" checked={data.srVegan} onChange={(v) => set("srVegan", v)} />
          <Check label="Prop 65" checked={data.srProp65} onChange={(v) => set("srProp65", v)} />
          <Check label="Non Allergen" checked={data.srAllergenFree} onChange={(v) => set("srAllergenFree", v)} />
          <Check label="Raw Material Claims" checked={data.srRawMaterialClaims} onChange={(v) => set("srRawMaterialClaims", v)} />
          <Check label="Going into retailers" checked={data.srRetailers} onChange={(v) => set("srRetailers", v)} />
          <Check label="Microbial" checked={data.srMicrobial} onChange={(v) => set("srMicrobial", v)} />
          <Check label="C of A (USP or equivalent)" checked={data.srCofA} onChange={(v) => set("srCofA", v)} />
          <Check label="Heavy Metal Testing" checked={data.srHeavyMetal} onChange={(v) => set("srHeavyMetal", v)} />
        </div>
        <div className="mt-3 max-w-md">
          <Text label="Other" value={data.srOther} onChange={(v) => set("srOther", v)} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <YesNo label="Selling internationally?" value={data.international} onChange={(v) => set("international", v)} />
          {data.international === "yes" && (
            <Text label="Which countries?" value={data.intlCountries} onChange={(v) => set("intlCountries", v)} />
          )}
        </div>
      </Section>
    </div>
  );
}

/** Product-type label, used in the parent's chrome. */
export function productTypeLabel(t: ProductType): string {
  return t === "capsule" ? "Capsules" : t === "powder" ? "Powder" : "Liquid";
}
