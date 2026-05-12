import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { updateUser } from "@/lib/users/store";
import { isAcceptableAvatarUrl } from "@/lib/users/avatar";

export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => null)) as { avatarUrl?: unknown } | null;
  if (!body || typeof body.avatarUrl !== "string") {
    return NextResponse.json({ error: "avatarUrl is required." }, { status: 400 });
  }
  if (!isAcceptableAvatarUrl(body.avatarUrl)) {
    return NextResponse.json(
      { error: "Avatar must be a path or a small image data URL (≤ 200 KB)." },
      { status: 400 },
    );
  }
  await updateUser(me.username, { avatarUrl: body.avatarUrl });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const me = await requireSession();
  await updateUser(me.username, { avatarUrl: null });
  return NextResponse.json({ ok: true });
}
