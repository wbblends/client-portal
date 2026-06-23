/**
 * Brand Researcher — identify endpoint.
 *
 * POST /api/tools/brand-researcher/identify   (application/json)
 *   { brand: string, clarification?: string }
 *
 * Runs a short web-search agentic loop, then forces the model to call the
 * `propose_brand` client tool so we get a clean, structured candidate back to
 * confirm with the rep before the (expensive) deep research runs. Returns the
 * BrandCandidate as JSON.
 *
 * Auth-gated to any signed-in user (the whole Tools area is).
 */
import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import {
  IDENTIFY_SYSTEM,
  PROPOSE_BRAND_TOOL,
  identifyUserPrompt,
  type BrandCandidate,
} from "@/lib/brand-researcher/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sonnet is plenty for "who is this company" and keeps the confirm step snappy.
const MODEL = "claude-sonnet-4-6";
const WEB_SEARCH: Anthropic.Messages.ToolUnion = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 6,
};

export async function POST(request: NextRequest) {
  await requireSession();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Brand research isn't configured (ANTHROPIC_API_KEY missing)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    brand?: unknown;
    clarification?: unknown;
  };
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const clarification =
    typeof body.clarification === "string" ? body.clarification.trim() : "";
  if (!brand) {
    return Response.json({ error: "Enter a brand name." }, { status: 400 });
  }
  if (brand.length > 200 || clarification.length > 1000) {
    return Response.json({ error: "That's a bit too long." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: identifyUserPrompt(brand, clarification) },
  ];

  try {
    // Let the model search the web (server tool, runs inline), then call
    // propose_brand (client tool). Loop handles the server-side `pause_turn`
    // continuation and waits for the propose_brand client tool call.
    for (let i = 0; i < 6; i++) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [
          {
            type: "text",
            text: IDENTIFY_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [WEB_SEARCH, PROPOSE_BRAND_TOOL],
        messages,
      });

      const proposal = message.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock =>
          b.type === "tool_use" && b.name === "propose_brand",
      );
      if (proposal) {
        return Response.json({ candidate: normalize(proposal.input) });
      }

      messages.push({ role: "assistant", content: message.content });

      // Server tool hit its internal iteration cap — resend to resume.
      if (message.stop_reason === "pause_turn") continue;

      // The model finished without proposing (rare). Nudge it once.
      if (message.stop_reason === "end_turn") {
        messages.push({
          role: "user",
          content: "Now call propose_brand with your best candidate.",
        });
        continue;
      }

      // Any other stop reason without a proposal: stop looping.
      break;
    }

    return Response.json(
      {
        error:
          "Couldn't pin down that brand. Try adding a website or a product detail.",
      },
      { status: 422 },
    );
  } catch (err) {
    console.error("[brand-researcher/identify] error:", err);
    const msg = err instanceof Error ? err.message : "Identification failed.";
    return Response.json({ error: msg }, { status: 502 });
  }
}

/** Coerce the model's tool input into a fully-populated BrandCandidate. */
function normalize(input: unknown): BrandCandidate {
  const o = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const conf = str(o.confidence);
  return {
    found: o.found !== false,
    name: str(o.name),
    website: str(o.website),
    oneLiner: str(o.oneLiner),
    category: str(o.category),
    hq: str(o.hq),
    confidence:
      conf === "high" || conf === "medium" || conf === "low" ? conf : "medium",
    question: str(o.question),
    alternatives: Array.isArray(o.alternatives)
      ? o.alternatives
          .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
          .map((a) => ({ name: str(a.name), hint: str(a.hint) }))
          .filter((a) => a.name)
          .slice(0, 3)
      : [],
  };
}
