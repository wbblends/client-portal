import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "./persistence";
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
 * User store backed by `<DATA_DIR>/users.json`. Mutations write the file
 * atomically; reads come from an in-memory cache hydrated on first access.
 *
 * Passwords are stored as scrypt hashes with a per-user salt — never
 * plaintext. TOTP secrets and recovery code hashes live alongside the
 * password hash and are stripped from the public projection.
 */

type UserRecord = PublicUser & {
  passwordSalt: string;
  passwordHash: string;
  /** Base32-encoded TOTP secret. Present once 2FA is set up (verified or not). */
  totpSecret?: string;
  /** Hashed (scrypt) one-time recovery codes. Each entry is removed on use. */
  recoveryCodeHashes?: string[];
};

const KEY_LENGTH = 64;
const STORE_FILE = "users.json";

function hashSecret(secret: string, salt?: string): { salt: string; hash: string } {
  const useSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(secret, useSalt, KEY_LENGTH).toString("hex");
  return { salt: useSalt, hash };
}

function verifyHash(secret: string, salt: string, hash: string): boolean {
  const candidate = scryptSync(secret, salt, KEY_LENGTH);
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
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    company: u.company,
    customerId: u.customerId,
    avatarUrl: u.avatarUrl,
    role: u.role,
    permissions: u.permissions,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    tokenVersion: u.tokenVersion,
    twoFactorEnabled: u.twoFactorEnabled,
  };
}

const SEED: Array<Omit<UserRecord, "passwordSalt" | "passwordHash" | "createdAt" | "updatedAt" | "tokenVersion" | "twoFactorEnabled"> & {
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

function persist() {
  writeJson(STORE_FILE, Array.from(store.values()));
}

function hydrate() {
  const persisted = readJson<UserRecord[]>(STORE_FILE, []);
  if (persisted.length > 0) {
    for (const raw of persisted) {
      // Backfill defaults for older records.
      store.set(raw.id, {
        ...raw,
        tokenVersion: typeof raw.tokenVersion === "number" ? raw.tokenVersion : 0,
        twoFactorEnabled: typeof raw.twoFactorEnabled === "boolean" ? raw.twoFactorEnabled : false,
      });
    }
    return;
  }
  const ts = nowISO();
  for (const entry of SEED) {
    const { password, ...rest } = entry;
    const { salt, hash } = hashSecret(password);
    store.set(rest.id, {
      ...rest,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: ts,
      updatedAt: ts,
      tokenVersion: 0,
      twoFactorEnabled: false,
    });
  }
  persist();
}

hydrate();

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

export function getUserByEmail(email: string): PublicUser | null {
  const target = email.trim().toLowerCase();
  for (const u of store.values()) {
    if (u.email.toLowerCase() === target) return toPublic(u);
  }
  return null;
}

/** Used by the session loader to compare token versions; never sent to clients. */
export function getTokenVersion(id: string): number | null {
  const u = store.get(id);
  return u ? u.tokenVersion : null;
}

export function getTotpSecret(id: string): string | null {
  const u = store.get(id);
  return u?.totpSecret ?? null;
}

export type CredentialResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "not_found" | "disabled" | "bad_password" };

export function verifyCredentials(username: string, password: string): CredentialResult {
  const target = username.trim().toLowerCase();
  for (const u of store.values()) {
    if (u.username.toLowerCase() !== target) continue;
    if (u.status !== "active") return { ok: false, reason: "disabled" };
    if (!verifyHash(password, u.passwordSalt, u.passwordHash)) {
      return { ok: false, reason: "bad_password" };
    }
    return { ok: true, user: toPublic(u) };
  }
  return { ok: false, reason: "not_found" };
}

/** Verify a password without side effects — used for self-service password change. */
export function checkPassword(id: string, password: string): boolean {
  const u = store.get(id);
  if (!u) return false;
  return verifyHash(password, u.passwordSalt, u.passwordHash);
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
  const { salt, hash } = hashSecret(input.password);
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
    tokenVersion: 0,
    twoFactorEnabled: false,
    passwordSalt: salt,
    passwordHash: hash,
  };
  store.set(record.id, record);
  persist();
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
  let bumpToken = false;

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
    if (updates.role !== existing.role) bumpToken = true;
    next.role = updates.role;
  }
  if (updates.permissions !== undefined) {
    next.permissions = dedupePermissions(updates.permissions);
  }
  if (updates.status !== undefined) {
    if (updates.status !== existing.status) bumpToken = true;
    next.status = updates.status;
  }
  if (updates.avatarUrl !== undefined) {
    next.avatarUrl = updates.avatarUrl ?? undefined;
  }

  if (bumpToken) next.tokenVersion = existing.tokenVersion + 1;
  next.updatedAt = nowISO();
  store.set(id, next);
  persist();
  return toPublic(next);
}

export function setPassword(id: string, newPassword: string): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const { salt, hash } = hashSecret(newPassword);
  store.set(id, {
    ...existing,
    passwordSalt: salt,
    passwordHash: hash,
    tokenVersion: existing.tokenVersion + 1,
    updatedAt: nowISO(),
  });
  persist();
}

export function generateTemporaryPassword(): string {
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
  persist();
}

export function resetPermissions(id: string): PublicUser {
  return updateUser(id, { permissions: [...DEFAULT_PERMISSIONS] });
}

/** Bulk operations — best-effort. Returns per-id success/failure. */
export type BulkResult = { id: string; ok: boolean; message?: string }[];

export function bulkUpdateStatus(ids: string[], status: UserStatus, excludeId?: string): BulkResult {
  return ids.map(id => {
    if (id === excludeId) return { id, ok: false, message: "Skipped self." };
    try {
      updateUser(id, { status });
      return { id, ok: true };
    } catch (err) {
      return { id, ok: false, message: err instanceof Error ? err.message : "Failed." };
    }
  });
}

export function bulkResetPermissions(ids: string[]): BulkResult {
  return ids.map(id => {
    try {
      resetPermissions(id);
      return { id, ok: true };
    } catch (err) {
      return { id, ok: false, message: err instanceof Error ? err.message : "Failed." };
    }
  });
}

export function bulkDelete(ids: string[], excludeId?: string): BulkResult {
  return ids.map(id => {
    if (id === excludeId) return { id, ok: false, message: "Skipped self." };
    try {
      deleteUser(id);
      return { id, ok: true };
    } catch (err) {
      return { id, ok: false, message: err instanceof Error ? err.message : "Failed." };
    }
  });
}

// 2FA helpers ---------------------------------------------------------------

/** Stage a not-yet-verified TOTP secret. Doesn't enable 2FA on its own. */
export function stageTotpSecret(id: string, base32Secret: string): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  store.set(id, { ...existing, totpSecret: base32Secret, updatedAt: nowISO() });
  persist();
}

/** After a successful first-time TOTP code, mark 2FA enabled and store recovery codes. */
export function enableTwoFactor(id: string, recoveryCodes: string[]): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  if (!existing.totpSecret) throw new Error("No staged TOTP secret to enable.");
  const hashes = recoveryCodes.map(code => {
    const { salt, hash } = hashSecret(code);
    return `${salt}:${hash}`;
  });
  store.set(id, {
    ...existing,
    twoFactorEnabled: true,
    recoveryCodeHashes: hashes,
    tokenVersion: existing.tokenVersion + 1,
    updatedAt: nowISO(),
  });
  persist();
}

export function disableTwoFactor(id: string): void {
  const existing = store.get(id);
  if (!existing) throw new Error("User not found.");
  store.set(id, {
    ...existing,
    twoFactorEnabled: false,
    totpSecret: undefined,
    recoveryCodeHashes: undefined,
    tokenVersion: existing.tokenVersion + 1,
    updatedAt: nowISO(),
  });
  persist();
}

/** Try a recovery code; if it matches it's consumed (removed) and returns true. */
export function consumeRecoveryCode(id: string, code: string): boolean {
  const existing = store.get(id);
  if (!existing?.recoveryCodeHashes?.length) return false;
  const remaining: string[] = [];
  let matched = false;
  for (const stored of existing.recoveryCodeHashes) {
    if (matched) {
      remaining.push(stored);
      continue;
    }
    const [salt, hash] = stored.split(":");
    if (salt && hash && verifyHash(code.trim(), salt, hash)) {
      matched = true;
      continue;
    }
    remaining.push(stored);
  }
  if (matched) {
    store.set(id, { ...existing, recoveryCodeHashes: remaining, updatedAt: nowISO() });
    persist();
  }
  return matched;
}

export function countRecoveryCodes(id: string): number {
  return store.get(id)?.recoveryCodeHashes?.length ?? 0;
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
