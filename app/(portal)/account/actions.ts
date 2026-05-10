"use server";

import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { buildAvatarUrl, deleteAvatar, saveAvatar } from "@/lib/avatar-storage";
import {
  checkPassword,
  setPassword,
  updateUser,
} from "@/lib/users";

export type AccountActionResult = {
  ok: boolean;
  message?: string;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function updateMyProfileAction(
  _prev: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const me = await requireSession();
  try {
    const next = updateUser(me.id, {
      name: readString(formData, "name"),
      email: readString(formData, "email"),
    });
    logEvent({
      action: "account.profile_updated",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: next.username,
    });
    revalidatePath("/account");
    return { ok: true, message: "Profile updated." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function changeMyPasswordAction(
  _prev: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const me = await requireSession();
  const current = readString(formData, "current");
  const next = readString(formData, "next");
  const confirm = readString(formData, "confirm");
  if (!current || !next || !confirm) {
    return { ok: false, message: "Fill in every field." };
  }
  if (next.length < 6) {
    return { ok: false, message: "New password must be at least 6 characters." };
  }
  if (next !== confirm) {
    return { ok: false, message: "New passwords don't match." };
  }
  if (!checkPassword(me.id, current)) {
    return { ok: false, message: "Current password is incorrect." };
  }
  try {
    setPassword(me.id, next);
    logEvent({
      action: "account.password_changed",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: me.username,
    });
    revalidatePath("/account");
    return { ok: true, message: "Password changed. You'll need to sign in again on other devices." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function uploadMyAvatarAction(
  _prev: AccountActionResult,
  formData: FormData,
): Promise<AccountActionResult> {
  const me = await requireSession();
  try {
    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose an image first." };
    }
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return { ok: false, message: "Only PNG, JPEG, WebP, or GIF images are allowed." };
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return { ok: false, message: "Image must be under 2 MB." };
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = saveAvatar(me.id, buf);
    if (!saved.ok) return { ok: false, message: saved.reason };
    updateUser(me.id, { avatarUrl: buildAvatarUrl(me.id) });
    logEvent({
      action: "account.avatar_changed",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: me.username,
    });
    revalidatePath("/account");
    return { ok: true, message: "Profile photo updated." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function removeMyAvatarAction(
  _prev: AccountActionResult,
  _formData: FormData,
): Promise<AccountActionResult> {
  const me = await requireSession();
  try {
    deleteAvatar(me.id);
    updateUser(me.id, { avatarUrl: null });
    logEvent({
      action: "account.avatar_changed",
      actorId: me.id,
      actorUsername: me.username,
      targetId: me.id,
      targetUsername: me.username,
      details: { removed: true },
    });
    revalidatePath("/account");
    return { ok: true, message: "Profile photo removed." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
