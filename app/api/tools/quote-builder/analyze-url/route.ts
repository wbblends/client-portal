/**
 * Quote Builder — analyze-from-URL endpoint.
 *
 * POST /api/tools/quote-builder/analyze-url   (application/json)
 *   { url: string, productHint?: "capsule" | "powder" | "liquid" | "" }
 *
 * The rep pastes a single product URL — a retail product page, a brand site,
 * an Amazon/iHerb listing — and we do our best to reverse-engineer a
 * manufacturing quote from it. Claude fetches the page itself with Anthropic's
 * server-side web_fetch tool (so we don't ship a brittle HTML scraper), reads
 * the Supplement Facts / ingredients / packaging, then calls the same
 * `submit_quote` tool the file-upload path uses. Response shape matches
 * /analyze so the client can merge both through applyExtracted():
 *   { detectedProductType, confidence, summary, fields }
 *
 * Auth-gated to any signed-in user (the whole Tools area is).
 */
import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { SUBMIT_QUOTE_TOOL } from "@/lib/quote-builder/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One or two page fetches plus extraction — give it a little room.
export const maxDuration = 120;

const MODEL = "claude-sonnet-4-6";
/** web_fetch is a server-side tool; submit_quote is our client tool. */
const TOOLS: Anthropic.Messages.ToolUnion[] = [
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 },
  SUBMIT_QUOTE_TOOL,
];

const SYSTEM = `You are the formulation assistant inside the WB Blends quote builder. WB Blends (Western Botanicals) is a contract manufacturer of supplements — capsules, tablets, powders, and liquids (tinctures, syrups, suspensions, oils).

A sales rep has pasted the URL of an existing, finished retail product (a brand site, a retail listing such as Amazon/iHerb, or a product detail page). The customer wants WB Blends to manufacture something like it. Your job: fetch the page, read it, and reverse-engineer as much of a manufacturing quote as the page actually supports.

Workflow:
- Use web_fetch to load the URL the rep gave you. If the key details (the Supplement Facts panel, full ingredient list, serving size, count/size) live on a clearly-linked sub-page of the SAME product, you may fetch one or two of those too. Do not wander to unrelated pages.
- Then call submit_quote exactly once.

Rules:
- Only record what the page actually shows. Leave anything you can't see blank ("" or false). Never invent an MOQ, price, timeline, or ingredient that isn't on the page.
- Read the Supplement/Nutrition Facts panel for composition: each ingredient with its label claim (amount per serving — mg for capsule/powder, grams for liquids). Raw-material assay/potency (e.g. "10:1", "98%") is rarely on a retail label — leave assay blank unless it's stated.
- Capture serving size and servings per container/bottle when listed.
- Infer detectedProductType from the dosage form (capsules/tablets → capsule; drink mix / loose powder → powder; tincture/liquid/oil/syrup → liquid).
- Map the brand and product name. A retail listing almost never includes a buyer contact or email — leave those blank.
- Pick up packaging hints when visible (bottle vs. pouch/stick pack, count).
- Confidence is usually "medium" or "low" here: a retail page is marketing, not a spec sheet. Say so.
- Write the summary for a busy rep: what the product is, what you pulled from the page, and — importantly — what a retail page can't tell us that they'll still need to confirm with the customer (assays, overages, MOQ/volumes, target price, timeline).`;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  await requireSession();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI analysis isn't configured (ANTHROPIC_API_KEY missing). You can still fill the form in by hand." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    url?: unknown;
    productHint?: unknown;
  };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const productHint = typeof body.productHint === "string" ? body.productHint.trim() : "";

  if (!url) {
    return Response.json({ error: "No URL was provided." }, { status: 400 });
  }
  if (!isHttpUrl(url)) {
    return Response.json(
      { error: "That doesn't look like a web link. Paste a full product URL starting with http:// or https://." },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content:
        `The rep is building a ${productHint || "(unspecified)"} quote from this product page:\n${url}\n\n` +
        `Fetch it, read the product details, then call submit_quote.`,
    },
  ];

  let toolUse: Anthropic.ToolUseBlock | undefined;
  try {
    // web_fetch is a server tool: the model emits the fetch, Anthropic runs it
    // and pauses the turn; we resend to let the model read the result and then
    // call submit_quote. A handful of rounds covers a page + a sub-page or two.
    for (let turn = 0; turn < 6; turn++) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
      messages.push({ role: "assistant", content: message.content });

      toolUse = message.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === "tool_use" && b.name === "submit_quote",
      );
      if (toolUse) break;
      // Server tool ran (web_fetch) — resume so the model can use the result.
      if (message.stop_reason === "pause_turn") continue;
      // Model stopped without fetching or submitting; nothing more to do.
      break;
    }
  } catch (err) {
    console.error("[quote-builder/analyze-url] anthropic error:", err);
    const msg = err instanceof Error ? err.message : "AI analysis failed.";
    return Response.json({ error: msg }, { status: 502 });
  }

  if (!toolUse) {
    return Response.json(
      { error: "Couldn't read a product from that link. The page may be blocked, empty, or not a product page — try a different URL or upload the details instead." },
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
    confidence: input.confidence ?? "low",
    summary: input.summary ?? "",
    fields: input.fields ?? {},
  });
}
