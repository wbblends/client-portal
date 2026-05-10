import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

/**
 * Demo-only auth. Users live in SQLite (seeded on first DB open) and the
 * session is a base64 JSON cookie holding the resolved user. Adequate for a
 * placeholder portal; not safe for production.
 *
 * To swap to a real provider, keep `getSession()` and `requireSession()` as the
 * only call sites and replace their implementations (Auth.js, Clerk, custom
 * JWT, etc.).
 *
 * Auth is enforced per page via `requireSession()` in server components — no
 * proxy/middleware. That keeps every page in the Node runtime so Buffer-based
 * session decoding works.
 */

export const SESSION_COOKIE = "wbb_session";

export type Role = "super_admin" | "internal" | "external";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  company: string;
  /**
   * The customer brand this session is currently scoped to. Always set so the
   * brand-scoped portal pages (Dashboard, Invoices, etc.) can rely on it.
   * For internal / super_admin users this is a default brand (the first
   * channel they own); they can still chat across all customers.
   */
  customerId: string;
  /** True for users not tied to a customer (internal staff, super admin). */
  internal: boolean;
  role: Role;
  /** Optional path under `public/`. Falls back to initials avatar when absent. */
  avatarUrl?: string;
  /** Hex color used for the initials avatar background. */
  avatarColor?: string;
};

type UserRow = {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: Role;
  customer_id: string | null;
  company: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

/** Default brand context for internal staff so brand-scoped pages still load. */
const DEFAULT_INTERNAL_CUSTOMER_ID = "C-1042";

function rowToSession(row: UserRow): SessionUser {
  const internal = row.customer_id == null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    company: row.company ?? "",
    customerId: row.customer_id ?? DEFAULT_INTERNAL_CUSTOMER_ID,
    internal,
    role: row.role,
    avatarUrl: row.avatar_url ?? undefined,
    avatarColor: row.avatar_color ?? undefined,
  };
}

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const row = db()
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim().toLowerCase()) as UserRow | undefined;
  if (!row || row.password !== password) return null;
  return rowToSession(row);
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

/** Refetch the user from DB. Use for role-sensitive checks in API routes. */
export function loadUser(id: string): SessionUser | null {
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ? rowToSession(row) : null;
}

function encodePayload(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user)).toString("base64url");
}

function decodePayload(value: string): SessionUser | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (
      typeof obj?.id === "string" &&
      typeof obj?.username === "string" &&
      typeof obj?.role === "string" &&
      typeof obj?.customerId === "string"
    ) {
      return obj as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}
