import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { updateUser } from "@/lib/users/store";

export async function PATCH(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }
  const name = body.name.trim();
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json(
      { error: "Name must be between 1 and 80 characters." },
      { status: 400 },
    );
  }
  await updateUser(me.username, { name });
  return NextResponse.json({ ok: true });
}
