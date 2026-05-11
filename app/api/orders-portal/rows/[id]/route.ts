import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  deleteOrdersRow,
  patchOrdersRow,
  type PatchOrdersRowInput,
} from "@/lib/orders/store";
import type { Tier } from "@/lib/data/orders-portal";

export const dynamic = "force-dynamic";

const ALLOWED_TIERS: (Tier | "")[] = ["", "AA", "A", "B", "C"];

function isTier(v: unknown): v is Tier | "" {
  return typeof v === "string" && (ALLOWED_TIERS as string[]).includes(v);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json(
      { error: "Only admins can edit the orders portal." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing row id." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: PatchOrdersRowInput = {};
  if (typeof body.customer === "string") patch.customer = body.customer;
  if (typeof body.rep === "string") patch.rep = body.rep;
  if (typeof body.cs === "string") patch.cs = body.cs;
  if (isTier(body.tier)) patch.tier = body.tier;
  if (Number.isFinite(Number(body.projection))) patch.projection = Number(body.projection);
  if (Array.isArray(body.months) && body.months.length === 12) {
    patch.months = body.months.map(v =>
      v === null || v === undefined || !Number.isFinite(Number(v))
        ? null
        : Number(v),
    );
  }
  const updated = await patchOrdersRow(id, patch, me.username);
  if (!updated) {
    return NextResponse.json({ error: "Row not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, row: updated });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json(
      { error: "Only admins can edit the orders portal." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing row id." }, { status: 400 });
  }
  await deleteOrdersRow(id);
  return NextResponse.json({ ok: true });
}
