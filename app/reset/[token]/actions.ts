"use server";

import { logEvent } from "@/lib/audit";
import { consumeResetToken } from "@/lib/reset-tokens";
import { getUser, setPassword } from "@/lib/users";

export type ResetActionResult = { ok: boolean; message?: string };

export async function completeResetAction(
  token: string,
  _prev: ResetActionResult,
  formData: FormData,
): Promise<ResetActionResult> {
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const confirm = (formData.get("confirm") as string | null)?.trim() ?? "";
  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords don't match." };
  }
  const userId = consumeResetToken(token);
  if (!userId) {
    return { ok: false, message: "This reset link is invalid or has expired." };
  }
  try {
    setPassword(userId, password);
    const user = getUser(userId);
    logEvent({
      action: "auth.password_reset_completed",
      actorId: userId,
      actorUsername: user?.username ?? null,
      targetId: userId,
      targetUsername: user?.username,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reset password.",
    };
  }
}
