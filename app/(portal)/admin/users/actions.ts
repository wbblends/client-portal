"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import {
  ALL_PERMISSIONS,
  createUser,
  deleteUser,
  generateTemporaryPassword,
  resetPermissions,
  setPassword,
  updateUser,
  type Permission,
  type Role,
} from "@/lib/users";

const ALLOWED_ROLES: Role[] = ["super_admin", "admin", "user"];
const ALLOWED_PERMISSION_IDS = new Set<Permission>(ALL_PERMISSIONS.map(p => p.id));

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

export type ActionResult = {
  ok: boolean;
  message?: string;
  /** When set after a password change, displays the new value once. */
  generatedPassword?: string;
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

function readRole(formData: FormData): Role | null {
  const v = readString(formData, "role");
  return ALLOWED_ROLES.includes(v as Role) ? (v as Role) : null;
}

export async function updateProfileAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();
  try {
    updateUser(userId, {
      name: readString(formData, "name"),
      username: readString(formData, "username"),
      email: readString(formData, "email"),
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
  await requireSuperAdmin();
  try {
    const role = readRole(formData);
    if (!role) return { ok: false, message: "Pick a valid role." };
    const permissions = readPermissions(formData);
    updateUser(userId, { role, permissions });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
  await requireSuperAdmin();
  try {
    resetPermissions(userId);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
  await requireSuperAdmin();
  try {
    const v = readString(formData, "status");
    if (v !== "active" && v !== "disabled") {
      return { ok: false, message: "Invalid status." };
    }
    updateUser(userId, { status: v });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
  await requireSuperAdmin();
  try {
    const provided = readString(formData, "password").trim();
    const password = provided || generateTemporaryPassword();
    if (provided && provided.length < 6) {
      return { ok: false, message: "Password must be at least 6 characters." };
    }
    setPassword(userId, password);
    revalidatePath(`/admin/users/${userId}`);
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

export async function uploadAvatarAction(
  userId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();
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
    const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
    updateUser(userId, { avatarUrl: dataUrl });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
  await requireSuperAdmin();
  try {
    updateUser(userId, { avatarUrl: null });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true, message: "Profile photo removed." };
  } catch (err) {
    return { ok: false, message: messageOf(err) };
  }
}

export async function deleteUserAction(userId: string): Promise<void> {
  await requireSuperAdmin();
  deleteUser(userId);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function createUserAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireSuperAdmin();
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
    revalidatePath("/admin/users");
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

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
