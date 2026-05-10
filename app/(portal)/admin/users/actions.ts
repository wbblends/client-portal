"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { buildAvatarUrl, deleteAvatar, saveAvatar } from "@/lib/avatar-storage";
import { buildResetUrl, sendEmail } from "@/lib/email";
import { createResetToken } from "@/lib/reset-tokens";
import {
  ALL_PERMISSIONS,
  bulkDelete,
  bulkResetPermissions,
  bulkUpdateStatus,
  createUser,
  deleteUser,
  disableTwoFactor,
  generateTemporaryPassword,
  getUser,
  resetPermissions,
  setPassword,
  updateUser,
  type Permission,
  type Role,
  type UserStatus,
} from "@/lib/users";

const ALLOWED_ROLES: Role[] = ["super_admin", "admin", "user"];
const ALLOWED_PERMISSION_IDS = new Set<Permission>(ALL_PERMISSIONS.map(p => p.id));

// The cropper component on the client always emits a square JPEG. We accept a
// modest cap server-side as a defense-in-depth — the canvas output is normally
// well under 100 KB.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  // Tolerate other types from older clients that may not run the cropper.
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ActionResult = {
  ok: boolean;
  message?: string;
  generatedPassword?: string;
  /** When set, a password-reset link the admin can copy. */
  resetUrl?: string;
  /** When set, expiry timestamp for `resetUrl`. */
  resetExpiresAt?: string;
};

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

function readPermissions(formData: FormData): Permission[] {
  const raw = formData.getAll("permissions");
  const out: Permission[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (ALLOWED_PERMISSION_IDS.has(v as Permission)) out.push(v as Permission);
  }
  return out;
}

function readIds(formData: FormData): string[] {
  const raw = formData.getAll("ids");
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function readRole(formData: FormData): Role | null {
  const v = readString(formData, "role");
  return ALLOWED_ROLES.includes(v as Role) ? (v as Role) : null;
}

function revalidateUserPaths(id: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/audit");
}

export async function updateProfileAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const before = getUser(userId);
    const next = updateUser(userId, {
      name: readString(formData, "name"),
      username: readString(formData, "username"),
      email: readString(formData, "email"),
    });
    logEvent({
      action: "user.profile_updated",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: next.id,
      targetUsername: next.username,
      details: {
        nameChanged: before?.name !== next.name,
        usernameChanged: before?.username !== next.username,
        emailChanged: before?.email !== next.email,
      },
    });
    revalidateUserPaths(userId);
    return { ok: true, message: "Profile updated." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function updateRoleAndPermissionsAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const role = readRole(formData);
    if (!role) return { ok: false, message: "Pick a valid role." };
    const permissions = readPermissions(formData);
    const before = getUser(userId);
    const next = updateUser(userId, { role, permissions });
    if (before && before.role !== next.role) {
      logEvent({
        action: "user.role_changed",
        actorId: actor.id,
        actorUsername: actor.username,
        targetId: next.id,
        targetUsername: next.username,
        details: { from: before.role, to: next.role },
      });
    }
    if (
      !before ||
      before.permissions.length !== next.permissions.length ||
      before.permissions.some(p => !next.permissions.includes(p))
    ) {
      logEvent({
        action: "user.permissions_changed",
        actorId: actor.id,
        actorUsername: actor.username,
        targetId: next.id,
        targetUsername: next.username,
        details: { permissions: next.permissions },
      });
    }
    revalidateUserPaths(userId);
    return { ok: true, message: "Role and permissions saved." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function resetPermissionsAction(
  userId: string,
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const next = resetPermissions(userId);
    logEvent({
      action: "user.permissions_reset",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: next.id,
      targetUsername: next.username,
    });
    revalidateUserPaths(userId);
    return { ok: true, message: "Permissions reset to defaults." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function setStatusAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const v = readString(formData, "status");
    if (v !== "active" && v !== "disabled") {
      return { ok: false, message: "Invalid status." };
    }
    const before = getUser(userId);
    const next = updateUser(userId, { status: v });
    if (before && before.status !== next.status) {
      logEvent({
        action: "user.status_changed",
        actorId: actor.id,
        actorUsername: actor.username,
        targetId: next.id,
        targetUsername: next.username,
        details: { from: before.status, to: next.status },
      });
    }
    revalidateUserPaths(userId);
    return { ok: true, message: v === "active" ? "User reactivated." : "User disabled." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function resetPasswordAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const provided = readString(formData, "password").trim();
    const password = provided || generateTemporaryPassword();
    if (provided && provided.length < 6) {
      return { ok: false, message: "Password must be at least 6 characters." };
    }
    setPassword(userId, password);
    const target = getUser(userId);
    logEvent({
      action: "user.password_reset",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: userId,
      targetUsername: target?.username,
      details: { generated: !provided },
    });
    revalidateUserPaths(userId);
    return {
      ok: true,
      message: provided
        ? "Password updated. Share it securely with the user."
        : "Temporary password generated. Share it securely with the user.",
      generatedPassword: password,
    };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function createResetLinkAction(
  userId: string,
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const target = getUser(userId);
    if (!target) return { ok: false, message: "User not found." };
    const { rawToken, expiresAt } = createResetToken(userId, {
      id: actor.id,
      username: actor.username,
    });
    const headerList = await headers();
    const origin =
      headerList.get("origin") ||
      (headerList.get("host") ? `${headerList.get("x-forwarded-proto") || "http"}://${headerList.get("host")}` : undefined);
    const url = buildResetUrl(rawToken, origin);

    // Best-effort email — currently a console stub. See lib/email.ts.
    await sendEmail({
      to: target.email,
      subject: "Reset your WB Blends portal password",
      text: `Hi ${target.name},\n\nA password reset was requested for your account. Open the link below to set a new password (valid for 24 hours):\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    });

    logEvent({
      action: "auth.password_reset_link_created",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: target.id,
      targetUsername: target.username,
    });
    revalidateUserPaths(userId);
    return {
      ok: true,
      message: "Reset link created. Copy it below or send via email.",
      resetUrl: url,
      resetExpiresAt: expiresAt,
    };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function disableTwoFactorAction(
  userId: string,
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const target = getUser(userId);
    if (!target) return { ok: false, message: "User not found." };
    if (!target.twoFactorEnabled) return { ok: false, message: "2FA is not enabled for this user." };
    disableTwoFactor(userId);
    logEvent({
      action: "auth.2fa_disabled",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: target.id,
      targetUsername: target.username,
    });
    revalidateUserPaths(userId);
    return { ok: true, message: "Two-factor authentication disabled." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function uploadAvatarAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
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
    if (!getUser(userId)) return { ok: false, message: "User not found." };

    const buf = Buffer.from(await file.arrayBuffer());
    const saved = saveAvatar(userId, buf);
    if (!saved.ok) return { ok: false, message: saved.reason };

    const next = updateUser(userId, { avatarUrl: buildAvatarUrl(userId) });
    logEvent({
      action: "user.avatar_changed",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: next.id,
      targetUsername: next.username,
    });
    revalidateUserPaths(userId);
    return { ok: true, message: "Profile photo updated." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function removeAvatarAction(
  userId: string,
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    deleteAvatar(userId);
    const next = updateUser(userId, { avatarUrl: null });
    logEvent({
      action: "user.avatar_removed",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: next.id,
      targetUsername: next.username,
    });
    revalidateUserPaths(userId);
    return { ok: true, message: "Profile photo removed." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function deleteUserAction(userId: string): Promise<void> {
  const actor = await requireSuperAdmin();
  const target = getUser(userId);
  deleteUser(userId);
  if (target) {
    logEvent({
      action: "user.deleted",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: target.id,
      targetUsername: target.username,
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}

export async function createUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  try {
    const role = readRole(formData);
    if (!role) return { ok: false, message: "Pick a valid role." };
    const providedPassword = readString(formData, "password").trim();
    const password = providedPassword || generateTemporaryPassword();
    if (providedPassword && providedPassword.length < 6) {
      return { ok: false, message: "Password must be at least 6 characters." };
    }
    const created = createUser({
      username: readString(formData, "username"),
      name: readString(formData, "name"),
      email: readString(formData, "email"),
      role,
      permissions: readPermissions(formData),
      password,
    });
    logEvent({
      action: "user.created",
      actorId: actor.id,
      actorUsername: actor.username,
      targetId: created.id,
      targetUsername: created.username,
      details: { role: created.role, generatedPassword: !providedPassword },
    });
    revalidatePath("/admin/users");
    revalidatePath("/admin/audit");
    return {
      ok: true,
      message: providedPassword
        ? `Created ${created.username}.`
        : `Created ${created.username}. Temporary password generated.`,
      generatedPassword: providedPassword ? undefined : password,
    };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

// Bulk actions ---------------------------------------------------------------

export type BulkResult = {
  ok: boolean;
  message?: string;
  succeeded?: number;
  failed?: number;
  errors?: { username?: string; message: string }[];
};

export async function bulkUpdateStatusAction(
  status: UserStatus,
  _prev: BulkResult,
  formData: FormData,
): Promise<BulkResult> {
  const actor = await requireSuperAdmin();
  const ids = readIds(formData);
  if (ids.length === 0) return { ok: false, message: "No users selected." };
  const results = bulkUpdateStatus(ids, status, actor.id);
  const succeeded = results.filter(r => r.ok).length;
  if (succeeded > 0) {
    logEvent({
      action: "user.bulk_status_changed",
      actorId: actor.id,
      actorUsername: actor.username,
      details: { to: status, count: succeeded },
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return summarize(results, status === "active" ? "reactivated" : "disabled");
}

export async function bulkResetPermissionsAction(
  _prev: BulkResult,
  formData: FormData,
): Promise<BulkResult> {
  const actor = await requireSuperAdmin();
  const ids = readIds(formData);
  if (ids.length === 0) return { ok: false, message: "No users selected." };
  const results = bulkResetPermissions(ids);
  const succeeded = results.filter(r => r.ok).length;
  if (succeeded > 0) {
    logEvent({
      action: "user.bulk_permissions_reset",
      actorId: actor.id,
      actorUsername: actor.username,
      details: { count: succeeded },
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return summarize(results, "had permissions reset");
}

export async function bulkDeleteAction(
  _prev: BulkResult,
  formData: FormData,
): Promise<BulkResult> {
  const actor = await requireSuperAdmin();
  const ids = readIds(formData);
  if (ids.length === 0) return { ok: false, message: "No users selected." };
  // Resolve usernames before deletion for the audit log.
  const targets = ids
    .map(id => getUser(id))
    .filter((u): u is NonNullable<typeof u> => !!u);
  const results = bulkDelete(ids, actor.id);
  const succeeded = results.filter(r => r.ok).length;
  if (succeeded > 0) {
    logEvent({
      action: "user.bulk_deleted",
      actorId: actor.id,
      actorUsername: actor.username,
      details: {
        count: succeeded,
        usernames: targets
          .filter(t => results.find(r => r.id === t.id)?.ok)
          .map(t => t.username),
      },
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  return summarize(results, "deleted");
}

function summarize(
  results: { id: string; ok: boolean; message?: string }[],
  pastTense: string,
): BulkResult {
  const succeeded = results.filter(r => r.ok).length;
  const failed = results.length - succeeded;
  const errors = results
    .filter(r => !r.ok && r.message)
    .map(r => ({ message: r.message as string }));
  if (succeeded === 0) {
    return {
      ok: false,
      message: errors[0]?.message ?? "No users were updated.",
      succeeded: 0,
      failed,
      errors,
    };
  }
  return {
    ok: true,
    message:
      failed === 0
        ? `${succeeded} user${succeeded === 1 ? "" : "s"} ${pastTense}.`
        : `${succeeded} ${pastTense}, ${failed} skipped.`,
    succeeded,
    failed,
    errors,
  };
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
