import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authenticate, createSession, createTwoFactorChallenge } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getUser } from "@/lib/users";

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string; remember?: boolean; next?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const username = body.username ?? "";
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  }

  const outcome = await authenticate(username, password);
  if (outcome.kind === "rejected") {
    logEvent({
      action: "auth.login_failure",
      actorId: null,
      actorUsername: null,
      details: { username, reason: outcome.reason },
    });
    const message =
      outcome.reason === "disabled"
        ? "This account is disabled. Contact your administrator."
        : "Invalid username or password.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const next = body.next && body.next.startsWith("/") ? body.next : "/dashboard";

  if (outcome.kind === "two_factor_required") {
    await createTwoFactorChallenge(outcome.userId, !!body.remember);
    const u = getUser(outcome.userId);
    return NextResponse.json({
      ok: true,
      twoFactorRequired: true,
      next: `/login/two-factor?next=${encodeURIComponent(next)}`,
      // Only the username is exposed — not the user id.
      username: u?.username ?? username,
    });
  }

  await createSession(outcome.user.id, !!body.remember);
  logEvent({
    action: "auth.login_success",
    actorId: outcome.user.id,
    actorUsername: outcome.user.username,
  });
  return NextResponse.json({ ok: true, next });
}
