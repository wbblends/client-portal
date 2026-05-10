import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin-check";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
