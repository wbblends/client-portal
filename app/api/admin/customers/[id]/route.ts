import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCustomer, updateCustomer } from "@/lib/data/store";
import { requireSuperAdminApi } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/admin/customers/[id]">,
) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;
  const customer = await getCustomer(id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

const STRING_FIELDS = ["name", "email", "primaryContact", "phone", "websiteUrl"] as const;

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/admin/customers/[id]">,
) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;

  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  for (const field of STRING_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      return NextResponse.json(
        { error: `Field "${field}" must be a string.` },
        { status: 400 },
      );
    }
    patch[field] = value.trim();
  }

  if (typeof patch.name === "string" && patch.name.length === 0) {
    return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
  }
  if (typeof patch.email === "string" && patch.email && !patch.email.includes("@")) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  if (typeof patch.websiteUrl === "string" && patch.websiteUrl) {
    try {
      // Allow bare hostnames; prepend https:// if scheme is missing.
      const candidate = /^https?:\/\//i.test(patch.websiteUrl)
        ? patch.websiteUrl
        : `https://${patch.websiteUrl}`;
      new URL(candidate);
      patch.websiteUrl = candidate;
    } catch {
      return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
    }
  }

  try {
    const customer = await updateCustomer(id, patch);
    return NextResponse.json({ customer });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }
    throw err;
  }
}
