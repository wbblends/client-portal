/**
 * Brand Researcher — HubSpot CRM lookup.
 *
 * POST /api/tools/brand-researcher/hubspot   (application/json)
 *   { name: string, website?: string }
 *
 * Returns whether the confirmed brand is already in our HubSpot and, if so, the
 * owner, lifecycle, last activity, and associated deals. Read-only.
 *
 * Gated to internal staff (role !== "customer") — this surfaces internal CRM
 * data, so customer-role portal logins must never reach it, even though the
 * rest of the Tools area is all-users.
 */
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { lookupCompanyInHubspot } from "@/lib/brand-researcher/hubspot-lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const user = await requireSession();
  if (user.role === "customer") {
    return Response.json({ error: "Not available." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    website?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  if (!name) {
    return Response.json({ error: "Missing company name." }, { status: 400 });
  }

  const lookup = await lookupCompanyInHubspot({ name, website });
  return Response.json({ lookup });
}
