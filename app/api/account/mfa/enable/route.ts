import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { requireSession } from "@/lib/auth";
import { getMfaState, setMfa } from "@/lib/users/store";

/**
 * Confirm enrollment by verifying the user can read codes from the secret we
 * just stored. On success, flip `mfa_enabled = 1` and return 8 single-use
 * recovery codes. The recovery codes are returned to the client ONCE — we
 * only persist their bcrypt hashes — so the user must save them now.
 */
export async function POST(request: NextRequest) {
  const me = await requireSession();
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const state = await getMfaState(me.username);
  if (!state || !state.secret) {
    return NextResponse.json(
      { error: "Setup hasn't started — generate a QR first." },
      { status: 400 },
    );
  }
  if (!authenticator.check(code, state.secret)) {
    return NextResponse.json({ error: "That code didn't match." }, { status: 401 });
  }

  // Generate 8 recovery codes (10-char hex chunks, "abcd-efgh-ijkl" style).
  const recoveryCodes = Array.from({ length: 8 }, () => formatRecoveryCode(randomBytes(6)));
  const recoveryHashes = await Promise.all(recoveryCodes.map(c => bcrypt.hash(c, 10)));
  await setMfa(me.username, {
    enabled: true,
    secret: state.secret,
    recoveryHashes,
  });

  return NextResponse.json({ ok: true, recoveryCodes });
}

function formatRecoveryCode(buf: Buffer): string {
  const hex = buf.toString("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
