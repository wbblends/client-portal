import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUser, setMfa } from "@/lib/users/store";

/**
 * Admin disables a user's 2FA (e.g. user lost their authenticator and ran out
 * of recovery codes). Use sparingly — after this the user can sign in with
 * just their password until they re-enroll.
 */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[username]/disable-mfa">,
) {
  await requireAdmin();
  const { username } = await ctx.params;
  const target = await getUser(username);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  await setMfa(target.username, { enabled: false, secret: null, recoveryHashes: null });
  return NextResponse.json({ ok: true });
}
