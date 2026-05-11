import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import {
  readMfaChallenge,
  clearMfaChallenge,
  createSession,
} from "@/lib/auth";
import {
  getUser,
  getMfaState,
  replaceRecoveryHashes,
} from "@/lib/users/store";

/**
 * Second-factor verification step. Accepts either:
 *   - a 6-digit TOTP code from the authenticator app, or
 *   - one of the user's recovery codes (consumed on use).
 *
 * Requires a valid MFA-challenge cookie set by the password step in
 * /api/auth/login. On success creates the real session and clears the
 * challenge cookie.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").replace(/[\s-]/g, "");
  if (!code) {
    return NextResponse.json({ error: "Enter a code." }, { status: 400 });
  }

  const challenge = await readMfaChallenge();
  if (!challenge) {
    return NextResponse.json(
      { error: "Your sign-in attempt expired. Start over." },
      { status: 400 },
    );
  }

  const user = await getUser(challenge.username);
  if (!user || !user.active || !user.mfaEnabled) {
    await clearMfaChallenge();
    return NextResponse.json({ error: "Sign-in invalid." }, { status: 400 });
  }

  const state = await getMfaState(user.username);
  if (!state || !state.secret) {
    await clearMfaChallenge();
    return NextResponse.json({ error: "MFA not configured." }, { status: 400 });
  }

  // Try TOTP first.
  let ok = false;
  if (/^\d{6}$/.test(code)) {
    ok = authenticator.check(code, state.secret);
  }

  // If not a valid TOTP, try recovery codes.
  if (!ok && state.recoveryHashes.length > 0) {
    for (let i = 0; i < state.recoveryHashes.length; i++) {
      // Recovery codes are stored as bcrypt hashes; comparing every code is
      // O(n*bcrypt) but n is small (8) and this only runs on sign-in.
      // eslint-disable-next-line no-await-in-loop
      const match = await bcrypt.compare(code, state.recoveryHashes[i]);
      if (match) {
        const remaining = state.recoveryHashes.filter((_, idx) => idx !== i);
        await replaceRecoveryHashes(user.username, remaining);
        ok = true;
        break;
      }
    }
  }

  if (!ok) {
    return NextResponse.json({ error: "That code didn't match." }, { status: 401 });
  }

  await createSession(
    {
      username: user.username,
      name: user.name,
      email: user.email,
      company: user.company,
      customerIds: user.customerIds,
      customerPermissions: user.customerPermissions,
      role: user.role,
      dashboards: user.dashboards,
      avatarUrl: user.avatarUrl,
      mfaEnabled: user.mfaEnabled,
      homeUrl: user.homeUrl,
    },
    challenge.remember,
  );
  await clearMfaChallenge();

  return NextResponse.json({ ok: true });
}
