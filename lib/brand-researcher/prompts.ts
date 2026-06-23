/**
 * Brand Researcher — shared prompts, tool schemas, and types.
 *
 * Two server tools from the Anthropic Messages API do the heavy lifting:
 *   - web_search_20260209  (with built-in dynamic filtering)
 *   - web_fetch_20260209
 * Both run server-side; we never execute them. The only client-side tool is
 * `propose_brand`, which the identify step forces so we get a clean candidate
 * back instead of free-text.
 *
 * Kept in one module so the (large, stable) system prompts cache cleanly at
 * the API layer — never interpolate per-request data into these strings.
 */
import type Anthropic from "@anthropic-ai/sdk";

// ─── Identify step ──────────────────────────────────────────────────────────

/** The structured candidate the identify step hands back to the UI. */
export type BrandCandidate = {
  found: boolean;
  name: string;
  website: string;
  oneLiner: string;
  category: string;
  hq: string;
  confidence: "high" | "medium" | "low";
  /** A short question to confirm we've got the right company, or "". */
  question: string;
  alternatives: { name: string; hint: string }[];
};

export const PROPOSE_BRAND_TOOL: Anthropic.Messages.Tool = {
  name: "propose_brand",
  description:
    "Record the single most likely brand/company the user is asking about, so it can be confirmed with them. Call this exactly once, after you've searched the web to pin down who they mean.",
  input_schema: {
    type: "object",
    properties: {
      found: {
        type: "boolean",
        description: "True if you found a real, specific company that matches.",
      },
      name: { type: "string", description: "Official company / brand name." },
      website: {
        type: "string",
        description: "Primary marketing website (https://…), or \"\" if unknown.",
      },
      oneLiner: {
        type: "string",
        description:
          "One sentence on what they actually sell (e.g. 'Probiotics and gut-health supplements sold DTC on Amazon').",
      },
      category: {
        type: "string",
        description:
          "Short product category (e.g. 'Supplement brand — capsules, gummies & powders').",
      },
      hq: {
        type: "string",
        description: "Headquarters city, state/country, or \"\" if unknown.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "How sure you are this is the company the user means.",
      },
      question: {
        type: "string",
        description:
          "If anything is ambiguous, a short yes/no question to confirm with the user. Otherwise \"\".",
      },
      alternatives: {
        type: "array",
        description:
          "Up to 3 other companies that could plausibly match the same name, each with a one-line hint to tell them apart.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            hint: { type: "string" },
          },
          required: ["name", "hint"],
        },
      },
    },
    required: ["found", "name", "confidence", "question", "alternatives"],
  },
};

export const IDENTIFY_SYSTEM = `You are the brand-identification step inside the WB Blends "Brand Researcher" tool. WB Blends (Western Botanicals) is a contract manufacturer of dietary supplements — capsules, tablets, powders, gummies, and liquids. A sales rep is about to deep-research a prospective customer brand, and first we need to make sure we have the RIGHT company.

The rep gives you a brand name (sometimes vague, sometimes with extra hints). Your job:
1. Use web_search to pin down the specific company they most likely mean — prefer consumer health / supplement / nutrition / beauty / food & beverage brands, since that's WB Blends' world, but don't force it if the evidence points elsewhere.
2. Identify their official name, website, what they sell, their category, and headquarters.
3. If the name is ambiguous (multiple real companies share it), pick the most likely one but surface the others as alternatives and ask a short clarifying question.
4. Call propose_brand exactly once with your best candidate. Always call it — even if confidence is low or you couldn't find them (set found=false and explain via the question field).

Be fast and decisive. A couple of targeted searches is enough — you are only confirming identity here, not doing the deep research yet.`;

export function identifyUserPrompt(brand: string, clarification: string): string {
  return [
    `Brand the rep typed: ${brand}`,
    clarification ? `\nAdditional detail from the rep: ${clarification}` : "",
    `\nSearch the web to confirm who this is, then call propose_brand.`,
  ].join("");
}

// ─── Deep-research step ─────────────────────────────────────────────────────

export const RESEARCH_SYSTEM = `You are the deep-research engine inside the WB Blends "Brand Researcher" tool. WB Blends / Western Botanicals is a US contract manufacturer (co-packer) of dietary supplements — capsules, tablets, powders, gummies, tinctures, and liquids. A sales rep is researching a prospective customer brand so they can open a conversation about manufacturing their products.

The rep has already confirmed WHICH company they mean. Your job is to do thorough, current web research and produce a single, well-cited intelligence brief that helps the rep land a manufacturing deal.

## How to work
- Use web_search and web_fetch aggressively and in multiple rounds. Search the company site, news, funding databases, retailer listings, LinkedIn (via web search, e.g. queries like \`site:linkedin.com/in "Company Name" "VP Supply Chain"\`), trade press, and the company's own About / careers pages.
- Ground every factual claim in something you actually found. If you can't find a number, say so plainly and give your best reasoned estimate labelled as an estimate — never invent a precise figure.
- Cite sources inline as markdown links on the relevant line.

## What to figure out
1. **Who they are** — a crisp snapshot: what they sell, category, founded, positioning, where/how they're sold (DTC, Amazon, retail, etc.), rough size/employee count.
2. **Revenue & manufacturing spend** — find or estimate annual revenue (cite the source or explain the basis for an estimate). Then compute an estimated annual **contract-manufacturing spend at roughly 10% of revenue** — show the math and call it an estimate.
3. **Manufacturing / co-packer intelligence** — where and with whom they likely manufacture. If they name a contract manufacturer publicly (in filings, packaging, FDA registration, LinkedIn, press), report it with the source. If not, reason explicitly about the most likely type of co-packer given their dosage forms, volume, and any geography clues (e.g. a Utah-based capsule brand probably uses an enterprise Utah/Western co-packer; a large gummy brand uses a high-capacity gummy house). Name plausible candidates and explain the reasoning, clearly flagged as informed speculation.
4. **Key people (LinkedIn)** — find real decision-makers, in this priority order:
   1. CEO / Founder
   2. Other C-suite (COO, CFO, CMO, Chief Supply Chain / Operations Officer, etc.)
   3. VPs, Presidents, SVPs, Partners
   4. Directors and functional leaders
   For the VP/Director layers, prioritise the roles that actually own a co-packing relationship: **Procurement / Purchasing, Supply Chain, Operations, Outside/Contract Manufacturing, Product Innovation / New Product Development (NPD/R&D), and Quality/Regulatory.**
   For each person give a markdown link to their LinkedIn. Prefer a direct profile URL you found via search; if you can't confirm a direct profile, link a LinkedIn people-search instead, formatted exactly as: https://www.linkedin.com/search/results/people/?keywords=PERSON%20NAME%20COMPANY (URL-encode spaces as %20). Note their title and why they matter.
5. **News, financing & momentum** — recent news, funding rounds / investors, M&A, leadership changes, new product launches, expansion, or anything signalling they're scaling manufacturing. Cite each.
6. **Recommended outreach approach** — given everything above, tell the rep specifically who to reach out to first and why, what angle to lead with, and a realistic way in (mutual-connection / warm-intro idea, relevant timing hook, or a specific pain point WB Blends could solve). If the prompt includes existing CRM context (the account is already in HubSpot), factor it in: if the account already has an owner or open deals, advise the rep to coordinate with the deal owner rather than cold-outreach, and tailor the angle to where the existing relationship stands. If it's net-new, say so.

## Output format — return ONLY GitHub-flavored markdown in exactly this structure:

## {Brand} — Brand Snapshot
{one or two short paragraphs}

## Revenue & Estimated Manufacturing Spend
- **Estimated annual revenue:** {figure or range}
- **Basis / source:** {link or reasoning}
- **Estimated annual contract-manufacturing spend (~10% of revenue):** {figure} — *estimate*
- {any caveats}

## Manufacturing & Co-Packer Intelligence
{findings + reasoning, with sources}

## Key People
### CEO / Founder
- [Name](url) — Title. {why they matter}
### Other C-Suite
- [Name](url) — Title. {note}
### VPs · Presidents · SVPs · Partners
- [Name](url) — Title. {note}
### Directors & Functional Leaders
- [Name](url) — Title (e.g. Procurement / Supply Chain / NPD / Quality). {note}

## News, Financing & Momentum
- {item} — [source](url)

## Recommended Outreach Approach
{specific, actionable guidance: who first, the angle, the way in}

Write tightly and skimmably. Lead each section with the most useful information. If a whole section comes up empty after genuine searching, keep the heading and say what you couldn't find and what the rep could check next. Do not add a preamble or sign-off outside this structure.`;

export function researchUserPrompt(args: {
  name: string;
  website: string;
  context: string;
  crmSummary?: string;
}): string {
  return [
    `Research this confirmed company and produce the brief.`,
    ``,
    `- Company: ${args.name}`,
    args.website ? `- Website: ${args.website}` : "",
    args.context ? `- What the rep already knows / cares about: ${args.context}` : "",
    args.crmSummary ? `\n[Existing CRM context — from our HubSpot, do not restate as its own section; use it to shape the outreach recommendation]\n${args.crmSummary}` : "",
    ``,
    `Begin searching now.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
