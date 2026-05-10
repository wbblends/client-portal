import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getTokenVersion,
  getUser,
  verifyCredentials,
  type Permission,
  type Role,
} from "./users";

/**
 * Demo auth. Sessions are a base64-encoded JSON cookie carrying the user's
 * id and a `tokenVersion` snapshot taken at sign-in. The canonical record is
 * read from the user store on each request, and the snapshot's tokenVersion
 * is compared with the current one — if a super admin has since changed the
 * user's role, status, or password, the session is rejected so the user is
 * forced back through `/login` (and through 2FA if enrolled).
 *
 * When 2FA is enrolled, password verification mints a *pending* challenge
 * cookie that only `/login/two-factor` can consume; the full session cookie
 * is only set after the second-factor code (or recovery code) verifies.
 */

export const SESSION_COOKIE = "wbb_session";
export const TWO_FACTOR_COOKIE = "wbb_2fa_pending";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  /** Optional path under `public/`, absolute URL, or `data:` URL. */
  avatarUrl?: string;
  role: Role;
  permissions: Permission[];
  twoFactorEnabled: boolean;
};

export type AuthRejectReason = "not_found" | "disabled" | "bad_password";

export type AuthOutcome =
  | { kind: "ok"; user: SessionUser }
  | { kind: "two_factor_required"; userId: string }
  | { kind: "rejected"; reason: AuthRejectReason };

export async function authenticate(username: string, password: string): Promise<AuthOutcome> {
  const result = verifyCredentials(username, password);
  if (!result.ok) return { kind: "rejected", reason: result.reason };
  if (result.user.twoFactorEnabled) {
    return { kind: "two_factor_required", userId: result.user.id };
  }
  return { kind: "ok", user: toSession(result.user) };
}

export async function createSession(userId: string, remember: boolean) {
  const tv = getTokenVersion(userId);
  if (tv == null) throw new Error("Cannot create session for unknown user.");
  const jar = await cookies();
  const payload = encodePayload({ id: userId, v: tv });
  jar.set(SESSION_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
  });
  jar.delete(TWO_FACTOR_COOKIE);
}

/** Issue a short-lived "password verified, awaiting 2FA" cookie. */
export async function createTwoFactorChallenge(userId: string, remember: boolean) {
  const jar = await cookies();
  const payload = encodePayload({ id: userId, v: 0, remember });
  jar.set(TWO_FACTOR_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 5, // 5 minutes
  });
}

export async function readTwoFactorChallenge(): Promise<{ userId: string; remember: boolean } | null> {
  const jar = await cookies();
  const cookie = jar.get(TWO_FACTOR_COOKIE);
  if (!cookie) return null;
  const payload = decodePayload(cookie.value);
  if (!payload) return null;
  return { userId: payload.id, remember: !!payload.remember };
}

export async function clearTwoFactorChallenge() {
  const jar = await cookies();
  jar.delete(TWO_FACTOR_COOKIE);
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(TWO_FACTOR_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE);
  if (!cookie) return null;
  const payload = decodePayload(cookie.value);
  if (!payload) return null;
  const user = getUser(payload.id);
  if (!user || user.status !== "active") return null;
  if (user.tokenVersion !== payload.v) return null;
  return toSession(user);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "super_admin") redirect("/dashboard");
  return user;
}

function toSession(u: {
  id: string;
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  avatarUrl?: string;
  role: Role;
  permissions: Permission[];
  twoFactorEnabled: boolean;
}): SessionUser {
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
    twoFactorEnabled: u.twoFactorEnabled,
  };
}

type CookiePayload = { id: string; v: number; remember?: boolean };

function encodePayload(payload: CookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): CookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj?.id === "string" && typeof obj?.v === "number") {
      return { id: obj.id, v: obj.v, remember: !!obj.remember };
    }
    return null;
  } catch {
    return null;
  }
}
