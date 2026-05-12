import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authenticateUser, setPassword } from "@/lib/users/store";

export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => null)) as
    | { currentPassword?: unknown; newPassword?: unknown }
    | null;
  if (
    !body ||
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return NextResponse.json(
      { error: "currentPassword and newPassword are required." },
      { status: 400 },
    );
  }
  if (body.newPassword.length < 10) {
    return NextResponse.json(
      { error: "New password must be at least 10 characters." },
      { status: 400 },
    );
  }
  const ok = await authenticateUser(me.username, body.currentPassword);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }
  await setPassword(me.username, body.newPassword);
  return NextResponse.json({ ok: true });
}
