import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import { resetOrdersRows } from "@/lib/orders/store";

export const dynamic = "force-dynamic";

/** POST — wipe the orders portal table and re-import ORDERS_PORTAL_SEED. */
export async function POST() {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json(
      { error: "Only admins can reset the orders portal." },
      { status: 403 },
    );
  }
  const rows = await resetOrdersRows();
  return NextResponse.json({ ok: true, rows });
}
