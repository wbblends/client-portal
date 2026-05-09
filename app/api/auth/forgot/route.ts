import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getUserByEmail } from "@/lib/users/store";
import { createToken } from "@/lib/auth/tokens";
import { sendEmail, publicBaseUrl } from "@/lib/email/sender";
import { resetEmail } from "@/lib/email/templates";

/**
 * Always returns success — never reveals whether an email exists in the
 * system. The actual reset email is only dispatched when we find a matching
 * active user.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (user && user.active) {
    const token = await createToken(user.username, "reset");
    const url = `${publicBaseUrl()}/auth/reset?token=${encodeURIComponent(token)}`;
    const msg = resetEmail({ name: user.name, resetUrl: url });
    try {
      await sendEmail({ to: user.email, ...msg });
    } catch (err) {
      console.error("[forgot] failed to send reset email", err);
      // Still return ok: don't leak existence/state to the requester.
    }
  }

  return NextResponse.json({ ok: true });
}
