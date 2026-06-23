/**
 * Quote Builder — merge AI-extracted fields onto a base QuoteData.
 *
 * Pure (no Node deps) so both the client form and the server can use it.
 * Rule: an extracted value only *overwrites* a blank/false base value — it
 * never clobbers something a rep already typed. Unknown keys are ignored, so
 * a stray field from the model can't corrupt the shape.
 */
import { emptyIngredient, type QuoteData, type Ingredient } from "./types";

type RawFields = Record<string, unknown>;

function mergeIngredients(raw: unknown): Ingredient[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as RawFields;
      const ing = emptyIngredient();
      for (const k of Object.keys(ing) as (keyof Ingredient)[]) {
        if (typeof o[k] === "string") ing[k] = o[k] as string;
        else if (typeof o[k] === "number") ing[k] = String(o[k]);
      }
      return ing;
    })
    .filter((r) => r.name.trim());
  return rows.length ? rows : null;
}

/**
 * Overlay `fields` from the AI onto `base`. Returns a new object. `base`
 * should already carry the chosen productType.
 */
export function applyExtracted(base: QuoteData, fields: RawFields): QuoteData {
  const out: QuoteData = { ...base, ingredients: base.ingredients.map((i) => ({ ...i })) };

  for (const [key, value] of Object.entries(fields)) {
    if (key === "ingredients" || key === "productType") continue;
    if (!(key in out)) continue;
    const cur = (out as RawFields)[key];

    if (typeof cur === "boolean") {
      if (value === true) (out as RawFields)[key] = true;
    } else if (typeof cur === "string") {
      if (!cur && (typeof value === "string" || typeof value === "number")) {
        const v = String(value).trim();
        if (v) (out as RawFields)[key] = v;
      }
    }
  }

  const ings = mergeIngredients(fields.ingredients);
  if (ings) {
    // Pad to at least 5 rows so the table still shows spare lines.
    while (ings.length < 5) ings.push(emptyIngredient());
    out.ingredients = ings;
  }

  return out;
}
