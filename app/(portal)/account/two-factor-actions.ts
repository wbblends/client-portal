"use server";

import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import {
  buildOtpAuthUrl,
  formatSecretForDisplay,
  generateBase32Secret,
  generateRecoveryCodes,
  verifyTotp,
} from "@/lib/totp";
import {
  checkPassword,
  disableTwoFactor as disableTwoFactorRecord,
  enableTwoFactor,
  getTotpSecret,
  getUser,
  stageTotpSecret,
} from "@/lib/users";

export type StartEnrollmentResult =
  | {
      ok: true;
      otpAuthUrl: string;
      secret: string;
      secretFormatted: string;
    }
  | { ok: false; message: string };

// Shown next to the 6-digit code inside Google Authenticator, 1Password,
// Authy, etc. Override per-environment with PORTAL_2FA_ISSUER if you want
// to distinguish prod from staging in the user's authenticator list.
const ISSUER = process.env.PORTAL_2FA_ISSUER || "WB Blends";

export async function startTwoFactorEnrollmentAction(): Promise<StartEnrollmentResult> {
  const me = await requireSession();
  try {
    const user = getUser(me.id);
    if (!user) return { ok: false, message: "User not found." };
    if (user.twoFactorEnabled) {
      return { ok: false, message: "Two-factor is already enabled. Disable it first to re-enroll." };
    }
    const secret = generateBase32Secret();
    stageTotpSecret(me.id, secret);
    const otpAuthUrl = buildOtpAuthUrl({
      secret,
      accountName: user.email || user.username,
      issuer: ISSUER,
    });
    return {
      ok: true,
      secret,
      secretFormatted: formatSecretForDisplay(secret),
      otpAuthUrl,
    };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export type ConfirmEnrollmentResult = {
  ok: boolean;
  message?: string;
  recoveryCodes?: string[];
};

export async function confirmTwoFactorEnrollmentAction(
  _prev: ConfirmEnrollmentResult,
  formData: FormData,
): Promise<ConfirmEnrollmentResult> {
  const me = await requireSession();
  try {
    const code = (formData.get("code") as string | null)?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) {
      return { ok: false, message: "Enter the 6-digit code from your app." };
    }
    const secret = getTotpSecret(me.id);
    if (!secret) {
      return { ok: false, message: "No pending enrollment. Start over." };
    }
    if (!verifyTotp(secret, code)) {
      return { ok: false, message: "That code didn't match. Try again — codes refresh every 30s." };
    }
    const recoveryCodes = generateRecoveryCodes(10);
    enableTwoFactor(me.id, recoveryCodes);
    logEvent({
      action: "auth.2fa_enabled",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: me.username,
    });
    revalidatePath("/account");
    return {
      ok: true,
      message: "Two-factor authentication is enabled.",
      recoveryCodes,
    };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export type DisableSelfResult = { ok: boolean; message?: string };

export async function disableMyTwoFactorAction(
  _prev: DisableSelfResult,
  formData: FormData,
): Promise<DisableSelfResult> {
  const me = await requireSession();
  try {
    const password = (formData.get("password") as string | null)?.trim() ?? "";
    if (!password) return { ok: false, message: "Confirm your password to disable 2FA." };
    if (!checkPassword(me.id, password)) {
      return { ok: false, message: "Password is incorrect." };
    }
    disableTwoFactorRecord(me.id);
    logEvent({
      action: "auth.2fa_disabled",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: me.username,
    });
    revalidatePath("/account");
    return { ok: true, message: "Two-factor authentication disabled." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
