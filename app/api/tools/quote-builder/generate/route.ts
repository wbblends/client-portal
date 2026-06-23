/**
 * Quote Builder — PDF generation endpoint.
 *
 * POST /api/tools/quote-builder/generate   (application/json)
 *   { productType, data }   — the finished QuoteData
 *
 * Loads the matching template (liquid.pdf or capsule-powder.pdf, bundled via
 * next.config `outputFileTracingIncludes`), fills its AcroForm fields, and
 * streams back the finished PDF as an attachment. Auth-gated to any signed-in
 * user.
 */
import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/auth";
import { fillQuotePdf } from "@/lib/quote-builder/fill";
import {
  emptyQuoteData,
  templateFileFor,
  PRODUCT_TYPES,
  type ProductType,
  type QuoteData,
} from "@/lib/quote-builder/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATE_DIR = path.join(process.cwd(), "lib", "quote-builder", "templates");

function safeName(s: string): string {
  return s.replace(/[^\w.\- ]+/g, "").trim().slice(0, 80);
}

/** Coerce an untrusted body into a full QuoteData, dropping unknown keys and
 *  keeping the empty-quote defaults for anything missing/wrong-typed. */
function coerce(productType: ProductType, raw: unknown): QuoteData {
  const base = emptyQuoteData(productType);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const target = base as unknown as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof QuoteData)[]) {
    if (key === "productType" || key === "ingredients") continue;
    const v = r[key];
    const cur = base[key];
    if (typeof cur === "boolean" && typeof v === "boolean") target[key] = v;
    else if (typeof cur === "string" && (typeof v === "string" || typeof v === "number"))
      target[key] = String(v);
  }
  if (Array.isArray(r.ingredients)) {
    base.ingredients = r.ingredients
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const o = x as Record<string, unknown>;
        const ing = { ...base.ingredients[0] };
        for (const k of Object.keys(ing) as (keyof typeof ing)[]) {
          const val = o[k];
          ing[k] = typeof val === "string" ? val : typeof val === "number" ? String(val) : "";
        }
        return ing;
      });
  }
  return base;
}

export async function POST(request: NextRequest) {
  await requireSession();

  const body = (await request.json().catch(() => null)) as {
    productType?: unknown;
    data?: unknown;
  } | null;

  const productType = String(body?.productType || "") as ProductType;
  if (!PRODUCT_TYPES.includes(productType)) {
    return Response.json({ error: "Invalid product type." }, { status: 400 });
  }

  const data = coerce(productType, body?.data);

  let template: Buffer;
  try {
    template = await readFile(path.join(TEMPLATE_DIR, templateFileFor(productType)));
  } catch (err) {
    console.error("[quote-builder/generate] template read failed:", err);
    return Response.json({ error: "Quote template is unavailable." }, { status: 500 });
  }

  let pdf: Uint8Array;
  try {
    pdf = await fillQuotePdf(new Uint8Array(template), data);
  } catch (err) {
    console.error("[quote-builder/generate] fill failed:", err);
    return Response.json({ error: "Could not build the PDF." }, { status: 500 });
  }

  const brand = safeName(data.brand) || "WB Blends";
  const product = safeName(data.product) || "Quote";
  const filename = `${brand} - ${product} - Quote Request.pdf`;

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
