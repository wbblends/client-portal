import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  revalidatePipelineCache,
  updateDeal,
  type DealFormat,
  type DealTier,
} from "@/lib/marketing/hubspot";
import { userCanSeeDashboard } from "@/lib/dashboards/registry";

const TIERS: readonly DealTier[] = ["AA", "A", "B", "C"];
const FORMATS: readonly DealFormat[] = ["Liquid", "Capsule", "Powder"];

async function gate() {
  const user = await requireSession();
  const canSee =
    userCanSeeDashboard(user.dashboards, "sales-pipeline", user.role) ||
    userCanSeeDashboard(user.dashboards, "account-expansion", user.role) ||
    userCanSeeDashboard(user.dashboards, "pipeline-analytics", user.role);
  return canSee ? user : null;
}

function parseTier(v: unknown): DealTier | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return TIERS.includes(v as DealTier) ? (v as DealTier) : undefined;
}

function parseFormat(v: unknown): DealFormat | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return FORMATS.includes(v as DealFormat) ? (v as DealFormat) : undefined;
}

function parseAmount(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/**
 * Update editable fields (tier, format, amount) on a HubSpot deal. Same gate
 * as the notes route — visibility to either pipeline dashboard implies write
 * access on these fields.
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/marketing/deals/[id]">,
) {
  const user = await gate();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid deal id" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tier?: unknown;
    format?: unknown;
    amount?: unknown;
    stageId?: unknown;
  };

  const patch: {
    tier?: DealTier | null;
    format?: DealFormat | null;
    amount?: number;
    stageId?: string;
  } = {};

  if ("tier" in body) {
    const t = parseTier(body.tier);
    if (t === undefined && body.tier !== undefined && body.tier !== null && body.tier !== "") {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }
    patch.tier = t ?? null;
  }
  if ("format" in body) {
    const f = parseFormat(body.format);
    if (f === undefined && body.format !== undefined && body.format !== null && body.format !== "") {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    patch.format = f ?? null;
  }
  if ("amount" in body) {
    const a = parseAmount(body.amount);
    if (a === undefined) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    patch.amount = a;
  }
  if ("stageId" in body) {
    if (typeof body.stageId !== "string" || !/^[\w-]+$/.test(body.stageId)) {
      return NextResponse.json({ error: "Invalid stage id" }, { status: 400 });
    }
    patch.stageId = body.stageId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const result = await updateDeal(id, patch);
    if (result.source === "placeholder") {
      return NextResponse.json(
        { error: "HubSpot token not configured." },
        { status: 503 },
      );
    }
    // Bust the kanban / pipeline summary / attribution caches so the next
    // home or marketing dashboard render reflects this edit immediately,
    // instead of waiting up to 5 minutes for the TTL.
    revalidatePipelineCache();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/marketing/deals] update failed:", err);
    return NextResponse.json({ error: "Failed to update deal." }, { status: 502 });
  }
}
