/**
 * Brand Researcher — deep-research endpoint (Server-Sent Events).
 *
 * POST /api/tools/brand-researcher/research   (application/json)
 *   { name: string, website?: string, context?: string }
 *
 * Streams the research as it happens. Each SSE line is a JSON object:
 *   { type: "search", query: string }   — model kicked off a web search
 *   { type: "fetch",  url: string }      — model fetched a page
 *   { type: "text",   delta: string }    — streaming markdown report
 *   { type: "done" }                     — finished
 *   { type: "error",  message: string }  — fatal error
 *
 * Uses Anthropic's server-side web_search + web_fetch tools (with dynamic
 * filtering), driven by Opus 4.8 at high effort. The loop resends on the
 * server tool's `pause_turn` so deep multi-round research can run past the
 * default server-tool iteration cap. Auth-gated to any signed-in user.
 */
import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { RESEARCH_SYSTEM, researchUserPrompt } from "@/lib/brand-researcher/prompts";
import {
  crmSummaryForPrompt,
  type CrmLookup,
} from "@/lib/brand-researcher/hubspot-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Deep research runs several rounds of web search — give it room. (Caps at the
// hosting plan's function limit; streaming keeps the connection alive.)
export const maxDuration = 300;

const MODEL = "claude-opus-4-8";
const TOOLS: Anthropic.Messages.ToolUnion[] = [
  { type: "web_search_20260209", name: "web_search", max_uses: 25 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 15 },
];

export async function POST(request: NextRequest) {
  const user = await requireSession();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Brand research isn't configured (ANTHROPIC_API_KEY missing)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    website?: unknown;
    context?: unknown;
    crm?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const context = typeof body.context === "string" ? body.context.trim() : "";
  if (!name) {
    return Response.json({ error: "Missing company name." }, { status: 400 });
  }

  // CRM context is only honored for internal staff — never let a customer-role
  // login slip HubSpot data into the prompt.
  const crmSummary =
    user.role !== "customer" && body.crm
      ? crmSummaryForPrompt(body.crm as CrmLookup)
      : "";

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: researchUserPrompt({ name, website, context, crmSummary }),
    },
  ];

  const encoder = new TextEncoder();
  const sse = (event: Record<string, unknown>) =>
    encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Up to ~12 turns of server-tool continuation. Each `pause_turn` means
        // the server tool loop paused mid-research and we resend to resume.
        for (let turn = 0; turn < 12; turn++) {
          const apiStream = client.messages.stream({
            model: MODEL,
            max_tokens: 32000,
            thinking: { type: "adaptive" },
            output_config: { effort: "high" },
            system: [
              {
                type: "text",
                text: RESEARCH_SYSTEM,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: TOOLS,
            messages,
          });

          for await (const event of apiStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(sse({ type: "text", delta: event.delta.text }));
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "server_tool_use"
            ) {
              const input = event.content_block.input as Record<string, unknown>;
              if (event.content_block.name === "web_search") {
                const query = typeof input?.query === "string" ? input.query : "";
                if (query) controller.enqueue(sse({ type: "search", query }));
              } else if (event.content_block.name === "web_fetch") {
                const url = typeof input?.url === "string" ? input.url : "";
                if (url) controller.enqueue(sse({ type: "fetch", url }));
              }
            }
          }

          const message = await apiStream.finalMessage();
          messages.push({ role: "assistant", content: message.content });

          // Resume the server-side tool loop; otherwise we're done.
          if (message.stop_reason === "pause_turn") continue;
          break;
        }

        controller.enqueue(sse({ type: "done" }));
      } catch (err) {
        console.error("[brand-researcher/research] stream error:", err);
        const message = err instanceof Error ? err.message : "Research failed.";
        controller.enqueue(sse({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
