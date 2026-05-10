import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createInvite, getCustomer, listInvitesForCustomer } from "@/lib/data/store";
import { requireSuperAdminApi } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/admin/customers/[id]/invites">,
) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  const invites = await listInvitesForCustomer(id);
  return NextResponse.json({ invites });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/customers/[id]/invites">,
) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  let body: { name?: unknown; email?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  const invite = await createInvite({ customerId: id, name, email });
  return NextResponse.json({ invite });
}
