import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { isAdminRole } from "@/lib/users/store";
import {
  createOrdersRow,
  listOrdersRows,
  applyOrderToRows,
  type CreateOrdersRowInput,
} from "@/lib/orders/store";
import type { Tier } from "@/lib/data/orders-portal";

export const dynamic = "force-dynamic";

const ALLOWED_TIERS: (Tier | "")[] = ["", "AA", "A", "B", "C"];

function isTier(v: unknown): v is Tier | "" {
  return typeof v === "string" && (ALLOWED_TIERS as string[]).includes(v);
}

/** GET — anyone with portal access can read the grid. */
export async function GET() {
  await requireSession();
  const rows = await listOrdersRows();
  return NextResponse.json({ rows });
}

/**
 * POST — create a row, or fold a submitted order into the grid.
 *
 * Two body shapes:
 *  1) `{ kind: "row", row: { customer, rep, cs, tier, projection, months } }`
 *  2) `{ kind: "order", customer, rep, cs, revenue, createdAt }`
 *     — same logic the localStorage flow used: bump the matching customer's
 *       current month if one exists, otherwise create a new row.
 */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  if (!isAdminRole(me.role)) {
    return NextResponse.json(
      { error: "Only admins can edit the orders portal." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    row?: Partial<CreateOrdersRowInput> & { tier?: unknown };
    customer?: string;
    rep?: string;
    cs?: string;
    revenue?: number;
    createdAt?: string;
  };

  if (body.kind === "order") {
    const customer = (body.customer ?? "").trim();
    if (!customer) {
      return NextResponse.json({ error: "Customer is required." }, { status: 400 });
    }
    const revenue = Number(body.revenue) || 0;
    const createdAt = body.createdAt || new Date().toISOString();
    const result = await applyOrderToRows({
      customer,
      rep: (body.rep ?? "").trim(),
      cs: (body.cs ?? "").trim(),
      revenue,
      createdAt,
      updatedBy: me.username,
    });
    return NextResponse.json({ ok: true, row: result.row, created: result.created });
  }

  const raw = body.row ?? {};
  const tier = isTier(raw.tier) ? raw.tier : "";
  const months =
    Array.isArray(raw.months) && raw.months.length === 12
      ? raw.months.map(v =>
          v === null || v === undefined || !Number.isFinite(Number(v))
            ? null
            : Number(v),
        )
      : Array(12).fill(null);

  const row = await createOrdersRow(
    {
      id: typeof raw.id === "string" ? raw.id : undefined,
      customer: typeof raw.customer === "string" ? raw.customer : "",
      rep: typeof raw.rep === "string" ? raw.rep : "",
      cs: typeof raw.cs === "string" ? raw.cs : "",
      tier,
      projection: Number(raw.projection) || 0,
      months,
    },
    me.username,
  );
  return NextResponse.json({ ok: true, row });
}
