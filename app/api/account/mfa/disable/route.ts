import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { authenticateUser, setMfa } from "@/lib/users/store";

/**
 * User disables MFA on their own account.
 *
 * Requires the current password to confirm — without that, an attacker who
 * borrows an unlocked browser tab could remove 2FA in one click.
 *
 * (Admins disabling someone else's MFA is a different endpoint —
 * /api/admin/users/[username]/disable-mfa.)
 */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  const password = body.password ?? "";
  if (!password) {
    return NextResponse.json({ error: "Confirm with your current password." }, { status: 400 });
  }
  const ok = await authenticateUser(me.username, password);
  if (!ok) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  await setMfa(me.username, { enabled: false, secret: null, recoveryHashes: null });
  return NextResponse.json({ ok: true });
}
