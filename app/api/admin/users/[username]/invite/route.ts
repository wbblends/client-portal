import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUser } from "@/lib/users/store";
import { createToken } from "@/lib/auth/tokens";
import { sendEmail, publicBaseUrl } from "@/lib/email/sender";
import { inviteEmail } from "@/lib/email/templates";

/** Resend the initial set-password invite. Useful when the original expired
 *  or the user lost it. Replaces any pending invite for this user. */
export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/admin/users/[username]/invite">,
) {
  const me = await requireAdmin();
  const { username } = await ctx.params;
  const target = await getUser(username);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const token = await createToken(target.username, "invite");
  const url = `${publicBaseUrl()}/auth/set-password?token=${encodeURIComponent(token)}`;
  const msg = inviteEmail({ name: target.name, inviteUrl: url, inviterName: me.name });
  try {
    await sendEmail({ to: target.email, ...msg });
  } catch (err) {
    console.error("[admin/users/invite] failed to send invite email", err);
    return NextResponse.json({ error: "Couldn't send invite. Check email config." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
