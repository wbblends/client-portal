import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, verifyCredentials, type Permission, type Role } from "./users";

/**
 * Demo-only auth. Sessions are a base64-encoded JSON cookie carrying the
 * user's id; the canonical user record (name, role, permissions) is read
 * from `lib/users.ts` on each request so admin edits take effect immediately.
 *
 * Auth is enforced per page via `requireSession()` / `requireSuperAdmin()`
 * in server components — no middleware/proxy is wired up. That keeps every
 * page's runtime in Node so Buffer-based session decoding works without Edge
 * runtime constraints.
 */

export const SESSION_COOKIE = "wbb_session";

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
};

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = verifyCredentials(username, password);
  return user ? toSession(user) : null;
}

export async function createSession(user: { id: string }, remember: boolean) {
  const jar = await cookies();
  const payload = encodePayload({ id: user.id });
  jar.set(SESSION_COOKIE, payload, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE);
  if (!cookie) return null;
  const payload = decodePayload(cookie.value);
  if (!payload) return null;
  const user = getUser(payload.id);
  if (!user || user.status !== "active") return null;
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
  };
}

type CookiePayload = { id: string };

function encodePayload(payload: CookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): CookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj?.id === "string") {
      return { id: obj.id };
    }
    return null;
  } catch {
    return null;
  }
}
