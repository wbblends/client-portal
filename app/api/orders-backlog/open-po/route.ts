import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import { listOpenPoEntries, recordOpenPoEntry } from "@/lib/orders/open-po-store";

export const dynamic = "force-dynamic";

/** GET — anyone with portal access can read the recorded daily figures. */
export async function GET() {
  await requireSession();
  const entries = await listOpenPoEntries(14);
  return NextResponse.json({ entries });
}

/** POST — record (or overwrite) the open-PO total for a given date. */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json(
      { error: "Only admins can record open-PO figures." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    date?: unknown;
    amount?: unknown;
  };

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "A valid date (YYYY-MM-DD) is required." },
      { status: 400 },
    );
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: "A valid non-negative amount is required." },
      { status: 400 },
    );
  }

  const entry = await recordOpenPoEntry({ date, amount, updatedBy: me.username });
  return NextResponse.json({ ok: true, entry });
}
