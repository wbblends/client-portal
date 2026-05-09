import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { requireSession } from "@/lib/auth";
import { setMfa } from "@/lib/users/store";

/**
 * Begin MFA enrollment.
 *
 * Generates a fresh TOTP secret and stores it on the user with
 * `mfa_enabled = 0`. The secret only "activates" once the user submits a
 * valid code via /api/account/mfa/enable. Until then the account works
 * normally without 2FA. Re-calling this regenerates the secret (lets the user
 * scan a fresh QR if they messed up the first scan).
 *
 * Returns the otpauth URL + a base64-encoded QR code data URL the client can
 * render directly. We do NOT return the raw secret in the response — it's
 * embedded in the otpauth URL for users who want to type it manually.
 */
export async function POST() {
  const me = await requireSession();
  const secret = authenticator.generateSecret();
  await setMfa(me.username, { enabled: false, secret, recoveryHashes: null });

  const issuer = "WB Blends Portal";
  const otpauth = authenticator.keyuri(me.email, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  return NextResponse.json({ ok: true, otpauth, qrDataUrl, secret });
}
