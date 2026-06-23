/**
 * Quote Builder — AI analyze endpoint.
 *
 * POST /api/tools/quote-builder/analyze   (multipart/form-data)
 *   files[]        — one or more uploaded supporting materials
 *   productHint    — optional "capsule" | "powder" | "liquid" the rep picked
 *
 * Reads every file (PDF/image natively; Word/Excel/Outlook/text extracted to
 * text — see lib/quote-builder/extract.ts), then has Claude fill a structured
 * quote via the `submit_quote` tool. Returns:
 *   { detectedProductType, confidence, summary, fields }
 *
 * Auth-gated to any signed-in user (the whole Tools area is). The client
 * uploads in size-capped batches and merges the per-batch results, so this
 * route stays well under the serverless request-body limit even when the rep
 * dumps in a pile of large specs.
 */
import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { fileToBlocks, type UploadedFile } from "@/lib/quote-builder/extract";
import { SUBMIT_QUOTE_TOOL } from "@/lib/quote-builder/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const MAX_FILES = 30;
/** Defensive per-request byte ceiling. The platform caps the request body
 *  anyway (~4.5MB); the client batches to stay under it. */
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;

const SYSTEM = `You are the formulation assistant inside the WB Blends quote builder. WB Blends (Western Botanicals) is a contract manufacturer of supplements — capsules, tablets, powders, and liquids (tinctures, syrups, suspensions, oils).

A sales rep has uploaded materials about a prospective customer's product: emails, product specs, formulas, spec sheets, Certificates of Analysis, brand briefs, spreadsheets, screenshots. Read ALL of it and extract everything relevant to a manufacturing quote, then call submit_quote exactly once.

Rules:
- Only record what the materials actually support. Leave anything uncertain blank ("" or false). Never guess a number, MOQ, price, or ingredient you don't see.
- For composition, capture each ingredient with its assay (raw-material potency/ratio, e.g. "10:1", "98%", "200:1") and label claim (amount per serving). Use mg for capsule/powder label claims, grams for liquids.
- Infer the product format for detectedProductType from the strongest signal (dosage form, packaging, language like "tincture"/"capsule"/"drink mix").
- Map customer contact name + company/brand + email when present.
- Write the summary for a busy rep: what the product is, what you filled, and what's still missing or ambiguous.`;

export async function POST(request: NextRequest) {
  await requireSession();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI analysis isn't configured (ANTHROPIC_API_KEY missing). You can still fill the form in by hand." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Could not read the upload." }, { status: 400 });
  }

  const productHint = String(form.get("productHint") || "").trim();
  const rawFiles = form.getAll("files").filter((f): f is File => f instanceof File);
  if (rawFiles.length === 0) {
    return Response.json({ error: "No files were uploaded." }, { status: 400 });
  }
  if (rawFiles.length > MAX_FILES) {
    return Response.json(
      { error: `Too many files in one batch (max ${MAX_FILES}).` },
      { status: 400 },
    );
  }

  let total = 0;
  const files: UploadedFile[] = [];
  for (const f of rawFiles) {
    const buf = new Uint8Array(await f.arrayBuffer());
    total += buf.byteLength;
    if (total > MAX_TOTAL_BYTES) {
      return Response.json(
        { error: "This batch is too large. Try fewer or smaller files at a time." },
        { status: 413 },
      );
    }
    files.push({ name: f.name, type: f.type, bytes: buf });
  }

  // Build the user turn: an intro line, the rep's format hint, then every file.
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text:
        `The rep is building a ${productHint || "(unspecified)"} quote. ` +
        `Here ${files.length === 1 ? "is the uploaded file" : `are the ${files.length} uploaded files`}:`,
    },
  ];
  for (const file of files) {
    content.push(...(await fileToBlocks(file)));
  }
  content.push({
    type: "text",
    text: "Now extract the quote and call submit_quote.",
  });

  const client = new Anthropic({ apiKey });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      tools: [SUBMIT_QUOTE_TOOL],
      tool_choice: { type: "tool", name: "submit_quote" },
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    console.error("[quote-builder/analyze] anthropic error:", err);
    const msg = err instanceof Error ? err.message : "AI analysis failed.";
    return Response.json({ error: msg }, { status: 502 });
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_quote",
  );
  if (!toolUse) {
    return Response.json(
      { error: "The AI couldn't extract a structured quote from these files." },
      { status: 422 },
    );
  }

  const input = toolUse.input as {
    detectedProductType?: string;
    confidence?: string;
    summary?: string;
    fields?: Record<string, unknown>;
  };

  return Response.json({
    detectedProductType: input.detectedProductType ?? "",
    confidence: input.confidence ?? "medium",
    summary: input.summary ?? "",
    fields: input.fields ?? {},
  });
}
