import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { syncTickets, type IncomingTicket } from "@/lib/tickets/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/tickets/sync
 *
 * Called once a day by the 7 AM coworker job after it generates the
 * WB_open_tickets spreadsheet. The coworker parses its own output and POSTs
 * the row data here so the portal page doesn't have to re-parse xlsx.
 *
 * Auth: `Authorization: Bearer <TICKETS_SYNC_TOKEN>`. Required — there is no
 * session because the coworker isn't a logged-in user.
 *
 * Body:
 *   {
 *     "tickets": [
 *       {
 *         "id": "T-1234",                  // required, unique
 *         "tab": "Active",                 // sheet name → portal tab
 *         "version": "v2",
 *         "name": "Lavender 5lb refill",
 *         "productType": "Bulk",
 *         "customer": "Acme",
 *         "salesperson": "Devin",
 *         "status": "In progress",
 *         "openDate": "2026-04-15",        // YYYY-MM-DD or any parseable date
 *         "dueDate": "2026-05-20"
 *       },
 *       ...
 *     ]
 *   }
 *
 * Behavior: upserts every incoming ticket on `id`. Existing tickets keep
 * their `rank` and `color`. Tickets in the DB but NOT in this payload get
 * `deleted_at` set; if they reappear in a future sync, the row (with its
 * rank+color) is restored.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.TICKETS_SYNC_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "TICKETS_SYNC_TOKEN not configured on the portal." },
      { status: 503 },
    );
  }
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!safeEqual(presented, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { tickets?: unknown }
    | null;
  if (!body || !Array.isArray(body.tickets)) {
    return NextResponse.json(
      { error: "Body must be { tickets: [...] }." },
      { status: 400 },
    );
  }

  const incoming: IncomingTicket[] = [];
  for (const raw of body.tickets) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const id = typeof t.id === "string" ? t.id.trim() : String(t.id ?? "").trim();
    const tab = typeof t.tab === "string" ? t.tab.trim() : "";
    if (!id || !tab) continue;
    incoming.push({
      tab,
      id,
      version: str(t.version),
      name: str(t.name),
      productType: str(t.productType ?? t.product_type),
      customer: str(t.customer),
      salesperson: str(t.salesperson),
      status: str(t.status),
      openDate: dateOrNull(t.openDate ?? t.open_date),
      dueDate: dateOrNull(t.dueDate ?? t.due_date),
    });
  }

  const result = await syncTickets(incoming);
  return NextResponse.json({ ok: true, ...result });
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function dateOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
