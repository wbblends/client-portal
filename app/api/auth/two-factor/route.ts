import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  clearTwoFactorChallenge,
  createSession,
  readTwoFactorChallenge,
} from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { consumeRecoveryCode, getTotpSecret, getUser } from "@/lib/users";
import { verifyTotp } from "@/lib/totp";

export async function POST(request: NextRequest) {
  const challenge = await readTwoFactorChallenge();
  if (!challenge) {
    return NextResponse.json(
      { error: "Two-factor session expired. Sign in again." },
      { status: 401 },
    );
  }
  const user = getUser(challenge.userId);
  if (!user) {
    await clearTwoFactorChallenge();
    return NextResponse.json({ error: "User not found." }, { status: 401 });
  }

  let body: { code?: string; mode?: "totp" | "recovery"; next?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  const mode = body.mode === "recovery" ? "recovery" : "totp";

  if (!code) {
    return NextResponse.json({ error: "Enter your code." }, { status: 400 });
  }

  let verified = false;
  let usedRecovery = false;

  if (mode === "totp") {
    const secret = getTotpSecret(user.id);
    if (!secret) {
      return NextResponse.json(
        { error: "Two-factor isn't enabled for this account." },
        { status: 400 },
      );
    }
    verified = verifyTotp(secret, code);
  } else {
    verified = consumeRecoveryCode(user.id, code);
    usedRecovery = verified;
  }

  if (!verified) {
    logEvent({
      action: "auth.login_failure",
      actorId: null,
      actorUsername: null,
      details: { username: user.username, reason: mode === "totp" ? "bad_totp" : "bad_recovery" },
    });
    return NextResponse.json({ error: "That code didn't match. Try again." }, { status: 401 });
  }

  await createSession(user.id, challenge.remember);

  logEvent({
    action: usedRecovery ? "auth.2fa_recovery_used" : "auth.login_success",
    actorId: user.id,
    actorUsername: user.username,
  });

  const next = typeof body.next === "string" && body.next.startsWith("/") ? body.next : "/dashboard";
  return NextResponse.json({ ok: true, next });
}
