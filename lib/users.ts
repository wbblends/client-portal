import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  type Permission,
  type PublicUser,
  type Role,
  type UserStatus,
} from "./users-shared";

export type {
  Permission,
  PublicUser,
  Role,
  UserStatus,
} from "./users-shared";
export { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, ROLE_LABELS } from "./users-shared";

/**
 * In-memory user store for the demo portal. Seeded on module load. Mutations
 * (admin edits, password resets, deletes) live for the lifetime of the server
 * process — not persistent across restarts. Swap this for a real database when
 * a backend is wired in; the API surface (`listUsers`, `updateUser`, etc.) is
 * what the rest of the app calls and is what should be preserved.
 *
 * Passwords are stored as scrypt hashes with a per-user salt — never plaintext.
 */

type UserRecord = PublicUser & {
  passwordSalt: string;
  passwordHash: string;
};

const KEY_LENGTH = 64;

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, useSalt, KEY_LENGTH).toString("hex");
  return { salt: useSalt, hash };
}

function verify(password: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const known = Buffer.from(hash, "hex");
  if (candidate.length !== known.length) return false;
  return timingSafeEqual(candidate, known);
}

function nowISO(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return "u_" + randomBytes(8).toString("hex");
}

function toPublic(u: UserRecord): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, passwordSalt, ...rest } = u;
  return rest;
}

const SEED: Array<Omit<UserRecord, "passwordSalt" | "passwordHash" | "createdAt" | "updatedAt"> & {
  password: string;
}> = [
  {
    id: "u_dsimmons",
    username: "dsimmons",
    name: "Devin Simmons",
    email: "devin@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    avatarUrl: "/avatars/dsimmons.jpg",
    role: "super_admin",
    permissions: DEFAULT_PERMISSIONS,
    status: "active",
    password: "test",
  },
  {
    id: "u_mlin",
    username: "mlin",
    name: "Maya Lin",
    email: "maya.lin@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    role: "admin",
    permissions: DEFAULT_PERMISSIONS,
    status: "active",
    password: "test",
  },
  {
    id: "u_rhayes",
    username: "rhayes",
    name: "Rachel Hayes",
    email: "rachel@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    role: "user",
    permissions: ["dashboard:read", "invoices:read", "contact:read"],
    status: "active",
    password: "test",
  },
  {
    id: "u_tnguyen",
    username: "tnguyen",
    name: "Thuy Nguyen",
    email: "thuy@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    role: "user",
    permissions: ["dashboard:read", "documents:read", "quality:read", "contact:read"],
    status: "active",
    password: "test",
  },
  {
    id: "u_jwong",
    username: "jwong",
    name: "Jamie Wong",
    email: "jamie@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    role: "user",
    permissions: ["dashboard:read", "contact:read"],
    status: "disabled",
    password: "test",
  },
];

const store = new Map<string, UserRecord>();

(function seed() {
  const ts = nowISO();
  for (const entry of SEED) {
    const { password, ...rest } = entry;
    const { salt, hash } = hashPassword(password);
    store.set(rest.id, {
      ...rest,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: ts,
      updatedAt: ts,
    });
  }
})();

export function listUsers(): PublicUser[] {
  return Array.from(store.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toPublic);
}

export function getUser(id: string): PublicUser | null {
  const u = store.get(id);
  return u ? toPublic(u) : null;
}

export function getUserByUsername(username: string): PublicUser | null {
  const target = username.trim().toLowerCase();
  for (const u of store.values()) {
    if (u.username.toLowerCase() === target) return toPublic(u);
  }
  return null;
}

export function verifyCredentials(username: string, password: string): PublicUser | null {
  const target = username.trim().toLowerCase();
  for (const u of store.values()) {
    if (u.username.toLowerCase() !== target) continue;
    if (u.status !== "active") return null;
    if (!verify(password, u.passwordSalt, u.passwordHash)) return null;
    return toPublic(u);
  }
  return null;
}

export type CreateUserInput = {
  username: string;
  name: string;
  email: string;
  company?: string;
  customerId?: string;
  role: Role;
  permissions: Permission[];
  password: string;
  avatarUrl?: string;
};

export function createUser(input: CreateUserInput): PublicUser {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{2,32}$/.test(username)) {
    throw new Error("Username must be 2–32 characters: lowercase letters, numbers, or underscore.");
  }
  if (getUserByUsername(username)) {
    throw new Error("That username is already taken.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const ts = nowISO();
  const { salt, hash } = hashPassword(input.password);
  const record: UserRecord = {
    id: makeId(),
    username,
    name: input.name.trim(),
    email: input.email.trim(),
    company: input.company?.trim() || "Devin's Test Brand",
    customerId: input.customerId?.trim() || "C-1042",
    avatarUrl: input.avatarUrl,
    role: input.role,
    permissions: dedupePermissions(input.permissions),
    status: "active",
    createdAt: ts,
    updatedAt: ts,
    passwordSalt: salt,
    passwordHash: hash,
  };
  store.set(record.id, record);
  return toPublic(record);
}

export type UpdateUserInput = Partial<{
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  role: Role;
  permissions: Permission[];
  status: UserStatus;
  avatarUrl: string | null;
}>;

export function updateUser(id: string, updates: UpdateUserInput): PublicUser {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");

  const next: UserRecord = { ...existing };

  if (updates.username !== undefined) {
    const username = updates.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(username)) {
      throw new Error("Username must be 2–32 characters: lowercase letters, numbers, or underscore.");
    }
    if (username !== existing.username) {
      const clash = getUserByUsername(username);
      if (clash && clash.id !== id) throw new Error("That username is already taken.");
    }
    next.username = username;
  }
  if (updates.name !== undefined) next.name = updates.name.trim();
  if (updates.email !== undefined) next.email = updates.email.trim();
  if (updates.company !== undefined) next.company = updates.company.trim();
  if (updates.customerId !== undefined) next.customerId = updates.customerId.trim();
  if (updates.role !== undefined) {
    if (existing.role === "super_admin" && updates.role !== "super_admin") {
      assertNotLastSuperAdmin(id);
    }
    next.role = updates.role;
  }
  if (updates.permissions !== undefined) {
    next.permissions = dedupePermissions(updates.permissions);
  }
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.avatarUrl !== undefined) {
    next.avatarUrl = updates.avatarUrl ?? undefined;
  }

  next.updatedAt = nowISO();
  store.set(id, next);
  return toPublic(next);
}

export function setPassword(id: string, newPassword: string): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const { salt, hash } = hashPassword(newPassword);
  store.set(id, { ...existing, passwordSalt: salt, passwordHash: hash, updatedAt: nowISO() });
}

export function generateTemporaryPassword(): string {
  // 14-char URL-safe-ish password. Avoids visually confusing characters.
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const buf = randomBytes(14);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += chars[buf[i] % chars.length];
  }
  return out;
}

export function deleteUser(id: string): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  if (existing.role === "super_admin") {
    assertNotLastSuperAdmin(id);
  }
  store.delete(id);
}

export function resetPermissions(id: string): PublicUser {
  return updateUser(id, { permissions: [...DEFAULT_PERMISSIONS] });
}

function assertNotLastSuperAdmin(idBeingChanged: string) {
  let count = 0;
  for (const u of store.values()) {
    if (u.role === "super_admin" && u.id !== idBeingChanged) count++;
  }
  if (count === 0) {
    throw new Error("Can't remove the last super admin. Promote someone else first.");
  }
}

function dedupePermissions(perms: Permission[]): Permission[] {
  const allowed = new Set(ALL_PERMISSIONS.map(p => p.id));
  const seen = new Set<Permission>();
  for (const p of perms) {
    if (allowed.has(p)) seen.add(p);
  }
  return Array.from(seen);
}
