import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { createDealNote, getDealNotes } from "@/lib/marketing/hubspot";
import { userCanSeeDashboard } from "@/lib/dashboards/registry";

const MAX_NOTE_LEN = 4000;

async function gate() {
  const user = await requireSession();
  const canSee =
    userCanSeeDashboard(user.dashboards, "sales-pipeline", user.role) ||
    userCanSeeDashboard(user.dashboards, "account-expansion", user.role) ||
    userCanSeeDashboard(user.dashboards, "pipeline-analytics", user.role);
  return canSee ? user : null;
}

/**
 * Returns the most recent 5 HubSpot notes for a given deal id. Gated to users
 * who can see either pipeline dashboard, since that's where the deal cards
 * appear.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/marketing/deals/[id]/notes">,
) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid deal id" }, { status: 400 });
  }

  const result = await getDealNotes(id, 5);
  return NextResponse.json(result);
}

/**
 * Creates a HubSpot note on the deal. The note is attributed to the HubSpot
 * owner whose email matches the logged-in portal user, when one exists.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/marketing/deals/[id]/notes">,
) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid deal id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Note body is required." }, { status: 400 });
  }
  if (text.length > MAX_NOTE_LEN) {
    return NextResponse.json(
      { error: `Note is too long (max ${MAX_NOTE_LEN} characters).` },
      { status: 400 },
    );
  }

  try {
    const result = await createDealNote(id, text, user.email);
    if (result.source === "placeholder") {
      return NextResponse.json(
        { error: "HubSpot token not configured." },
        { status: 503 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/marketing/deals/notes] create failed:", err);
    return NextResponse.json({ error: "Failed to create note." }, { status: 502 });
  }
}
