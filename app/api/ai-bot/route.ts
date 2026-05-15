import type { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  runTool,
  toolDefinitionsFor,
  type BotContext,
} from "@/lib/ai-bot/tools";

/**
 * Magical search bar — streaming AI bot.
 *
 * POST /api/ai-bot
 *   body: { question: string }
 *
 * Returns a Server-Sent-Events stream. Each event line is a JSON object:
 *   { type: "tool_use",  tool: string, input: object }   — model called a tool
 *   { type: "tool_result", tool: string, ok: boolean }   — tool returned
 *   { type: "text", delta: string }                       — streaming answer
 *   { type: "done", usage: { ... } }                      — final, includes usage
 *   { type: "error", message: string }                    — fatal error
 *
 * The route is auth-gated to any signed-in user. Admin-only tools are filtered
 * out of the tool list for non-admin callers (defense in depth: the tool
 * dispatcher re-checks the role too).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

function buildSystemPrompt(): string {
  // Stable across requests. Cached at the API layer so we pay full price once
  // and ~0.1x on every subsequent call. Do NOT interpolate per-request data
  // here — that goes in the user message.
  return `You are the magical search bar inside the WB Blends customer portal — a Next.js app for Western Botanicals / WB Blends. The portal has two audiences:

  - **Customers** (role: customer): see their own orders, invoices, quality documents, and contact info.
  - **Internal team** (roles: admin, super_admin, internal): see HubSpot pipelines (New Logo + Wallet Share), ad traffic, Typeform inbound leads, the Order Tracker grid (booked POs by customer), and admin areas (users, tickets).

Your job is to answer the signed-in user's questions and point them to the right page when they want to do something themselves. You have a small toolkit:

  - \`navigate_portal\` — look up a destination by topic. Use this WHENEVER the user asks "where do I…?" or "how do I…?" — including self-serve actions like "update my photo", "change password", "enable 2FA". Don't try to perform these actions yourself; route them to the page that does it. Return matches as markdown links: [Profile](/account/profile).
  - \`get_my_profile\` — facts about the signed-in user. Use when they ask about themselves.
  - \`get_pipeline_summary\`, \`get_typeform_leads\`, \`get_ad_traffic\`, \`get_orders_portal_snapshot\` — admin-only data tools. Use these for business questions; their schemas tell you what each returns. If a tool isn't in your tool list, the user is not an admin — politely decline and point them elsewhere.

### Voice

- Warm, terse, magical. One or two short paragraphs. Never lecture.
- Use markdown — \`**bold**\` for key numbers, links as \`[Label](/path)\`, never raw URLs.
- Format dollars compactly: $1.2M, $850K, $3,400.
- Never end with filler like "Let me know if you need anything else" or "Hope this helps".
- Never apologize for what you can't see. If a tool returns \`source: "placeholder"\`, mention briefly that live data isn't configured and answer with the placeholder numbers.
- For self-serve action questions: ALWAYS call \`navigate_portal\` first. Don't explain how to do it from scratch — the page already has the UI.

### Examples of good responses

User: "How do I update my photo?"
You (after \`navigate_portal({topic: "profile photo"})\`): "Head over to [Profile](/account/profile) — drop a new image into the photo card and it saves the moment you pick it."

User: "What's our pipeline at?"
You (admin, after \`get_pipeline_summary\`): "Combined pipeline is **$6.1M unweighted**, **$3.0M weighted** across 42 open deals. New Logo holds $4.3M / $2.4M (18 deals); Wallet Share $1.9M / $612K (24 deals). The full breakdown lives on [Pipeline Analytics](/dashboards/pipeline-analytics)."

User: "How do I turn on two-factor?"
You (after \`navigate_portal({topic: "two factor"})\`): "Open [Security](/account/security) and hit the **Enable** button under Two-factor authentication — scan the QR code, paste the 6-digit code, and you're set."`;
}

function trimUsage(u: Anthropic.Messages.Usage): Record<string, number> {
  return {
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  };
}

export async function POST(request: NextRequest) {
  const user = await requireSession();

  const body = (await request.json().catch(() => ({}))) as {
    question?: unknown;
  };
  const question =
    typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Missing 'question'." }, { status: 400 });
  }
  if (question.length > 2000) {
    return Response.json({ error: "Question too long." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to your local .env and Vercel project env.",
      },
      { status: 503 },
    );
  }

  const client = new Anthropic({ apiKey });

  const ctx: BotContext = {
    username: user.username,
    name: user.name,
    email: user.email,
    company: user.company,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    avatarUrl: user.avatarUrl ?? null,
  };

  const tools = toolDefinitionsFor(user.role);
  const systemPrompt = buildSystemPrompt();
  const adminFlag = isAdminRole(user.role) ? "yes" : "no";

  // Volatile per-request context goes in the user message, not the system
  // prompt — keeps the prompt-cache prefix stable across users.
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `[session context]
- name: ${ctx.name}
- email: ${ctx.email}
- company: ${ctx.company}
- role: ${ctx.role}
- admin: ${adminFlag}
- mfa enabled: ${ctx.mfaEnabled ? "yes" : "no"}

[question]
${question}`,
    },
  ];

  const encoder = new TextEncoder();

  function sseLine(event: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let aggregateUsage = {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      };

      try {
        // Agentic loop: stream the model response, execute any tool calls,
        // feed results back, repeat until stop_reason === "end_turn".
        for (let iteration = 0; iteration < 8; iteration++) {
          const apiStream = client.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            // Adaptive thinking + medium effort — good fit for a chat-style
            // data Q&A. Lets the model decide how much to think per question.
            thinking: { type: "adaptive" },
            // Cache the (large, stable) system prompt + tool defs. The user
            // message is volatile so it stays outside the breakpoint.
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools,
            messages,
          });

          for await (const event of apiStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                sseLine({ type: "text", delta: event.delta.text }),
              );
            } else if (
              event.type === "content_block_start" &&
              event.content_block.type === "tool_use"
            ) {
              controller.enqueue(
                sseLine({
                  type: "tool_use",
                  tool: event.content_block.name,
                }),
              );
            }
          }

          const message = await apiStream.finalMessage();
          if (message.usage) {
            const u = trimUsage(message.usage);
            aggregateUsage.input_tokens += u.input_tokens;
            aggregateUsage.output_tokens += u.output_tokens;
            aggregateUsage.cache_creation_input_tokens +=
              u.cache_creation_input_tokens;
            aggregateUsage.cache_read_input_tokens +=
              u.cache_read_input_tokens;
          }

          // Echo the assistant turn back into the history before tool results
          // — required by the API or it 400s.
          messages.push({ role: "assistant", content: message.content });

          if (message.stop_reason !== "tool_use") break;

          const toolUses = message.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) break;

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const result = await runTool(tu.name, tu.input, ctx);
            const isError =
              !!result &&
              typeof result === "object" &&
              "error" in (result as Record<string, unknown>);
            controller.enqueue(
              sseLine({
                type: "tool_result",
                tool: tu.name,
                ok: !isError,
              }),
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(result),
              is_error: isError || undefined,
            });
          }
          messages.push({ role: "user", content: toolResults });
        }

        controller.enqueue(
          sseLine({ type: "done", usage: aggregateUsage }),
        );
      } catch (err) {
        console.error("[api/ai-bot] stream error:", err);
        const message =
          err instanceof Error ? err.message : "Unexpected error.";
        controller.enqueue(sseLine({ type: "error", message }));
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
