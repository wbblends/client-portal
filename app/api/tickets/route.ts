import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import { listTickets, getLastSyncedAt } from "@/lib/tickets/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const tickets = await listTickets();
  const lastSyncedAt = await getLastSyncedAt();
  return NextResponse.json({ tickets, lastSyncedAt });
}
