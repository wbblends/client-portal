import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { findValidToken, consumeToken } from "@/lib/auth/tokens";
import { setPassword, getUser } from "@/lib/users/store";
import { createSession } from "@/lib/auth";

/**
 * Used by both the invite-completion flow and the password-reset flow — the
 * token's `kind` distinguishes them. On success we sign the user in
 * automatically (the spec for both flows says they go straight into the app).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  const token = (body.token ?? "").trim();
  const password = body.password ?? "";
  if (!token || !password) {
    return NextResponse.json({ error: "Missing token or password." }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters." },
      { status: 400 },
    );
  }

  // Try invite first, then reset. Either consumes a token of the matching kind.
  const found =
    (await findValidToken(token, "invite")) ?? (await findValidToken(token, "reset"));
  if (!found) {
    return NextResponse.json(
      { error: "This link is invalid or has expired. Ask an admin to send a new one." },
      { status: 400 },
    );
  }

  await setPassword(found.username, password);
  await consumeToken(found.token);

  const user = await getUser(found.username);
  if (user) {
    await createSession(
      {
        username: user.username,
        name: user.name,
        email: user.email,
        company: user.company,
        customerIds: user.customerIds,
        role: user.role,
        dashboards: user.dashboards,
        avatarUrl: user.avatarUrl,
        mfaEnabled: user.mfaEnabled,
      },
      true,
    );
  }
  return NextResponse.json({ ok: true });
}
