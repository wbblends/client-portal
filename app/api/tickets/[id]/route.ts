import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  isTicketColor,
  patchTicket,
  type PatchTicketInput,
} from "@/lib/tickets/store";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/tickets/:id — body must include `tab` since (tab, id) is the
 * composite key. URL-encoding "R&D" / "Document Request" through a second
 * dynamic segment is doable but uglier; keeping the URL flat and putting
 * `tab` in the body is simpler for the client.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const { id: rawId } = await context.params;
  const id = decodeURIComponent(rawId ?? "");
  if (!id) {
    return NextResponse.json({ error: "Missing ticket id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const tab = typeof body.tab === "string" ? body.tab : "";
  if (!tab) {
    return NextResponse.json(
      { error: "Body must include `tab`." },
      { status: 400 },
    );
  }

  const patch: PatchTicketInput = {};

  if ("color" in body) {
    const v = body.color;
    if (v === null || v === "") {
      patch.color = null;
    } else if (isTicketColor(v)) {
      patch.color = v;
    } else {
      return NextResponse.json(
        { error: "color must be 'red', 'white', 'gray', or null." },
        { status: 400 },
      );
    }
  }

  if ("rank" in body) {
    const v = body.rank;
    if (v === null || v === "") {
      patch.rank = null;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      patch.rank = Math.trunc(v);
    } else if (typeof v === "string" && /^-?\d+$/.test(v.trim())) {
      patch.rank = parseInt(v.trim(), 10);
    } else {
      return NextResponse.json(
        { error: "rank must be an integer or null." },
        { status: 400 },
      );
    }
  }

  const updated = await patchTicket(tab, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ticket: updated });
}
