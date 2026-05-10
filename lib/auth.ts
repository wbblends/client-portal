import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserByUsername, type Role } from "@/lib/data/store";

/**
 * Demo-only auth. Users live in `data/users.json`. Sessions are stored as a
 * base64-encoded JSON cookie — adequate for a placeholder portal but not safe
 * for production.
 *
 * Future: replace with a real provider. Recommended path is to keep
 * `getSession()` and `requireSession()` as the only call sites and swap their
 * implementations (e.g. to Auth.js, Clerk, or your own JWT verification).
 *
 * Auth is enforced per page via `requireSession()` in server components — no
 * middleware/proxy is wired up. That keeps every page's runtime in Node so
 * Buffer-based session decoding works without Edge runtime constraints.
 */

export const SESSION_COOKIE = "wbb_session";

export type SessionUser = {
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  role: Role;
  permissions: string[];
  /** Optional path under `public/`. Falls back to initials avatar when absent. */
  avatarUrl?: string;
};

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const stored = await getUserByUsername(username);
  if (!stored || stored.password !== password) return null;
  return toSessionUser(stored);
}

export function toSessionUser(stored: {
  username: string;
  name: string;
  email: string;
  customerId: string;
  role: Role;
  permissions: string[];
  avatarUrl?: string;
}): SessionUser {
  return {
    username: stored.username,
    name: stored.name,
    email: stored.email,
    company: "", // Resolved at request time from the customer store.
    customerId: stored.customerId,
    role: stored.role,
    permissions: stored.permissions,
    avatarUrl: stored.avatarUrl,
  };
}

export async function createSession(user: SessionUser, remember: boolean) {
  const jar = await cookies();
  const payload = encodePayload(user);
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
  return decodePayload(cookie.value);
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

function encodePayload(user: SessionUser): string {
  // Buffer is available because proxy/route handlers run in Node runtime.
  return Buffer.from(JSON.stringify(user)).toString("base64url");
}

function decodePayload(value: string): SessionUser | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (
      typeof obj?.username === "string" &&
      typeof obj?.customerId === "string" &&
      typeof obj?.role === "string"
    ) {
      // `permissions` may be missing on older sessions issued before role was added.
      const permissions = Array.isArray(obj.permissions) ? obj.permissions : [];
      return { ...obj, permissions } as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}
