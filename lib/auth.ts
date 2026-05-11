import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  authenticateUser,
  getUser,
  isAdminRole,
  type CustomerPermission,
  type UserRole,
} from "@/lib/users/store";
import {
  customerForUser,
  customerPermissionFor,
  getCustomer,
  type Customer,
} from "@/lib/customers/registry";

/**
 * Session auth.
 *
 * Cookies are HMAC-signed JSON blobs. The signing key comes from
 * SESSION_SECRET; if unset (dev), a stable fallback is used and a one-time
 * warning is logged so the developer knows. In production, set SESSION_SECRET
 * to a long random string (e.g. `openssl rand -base64 48`).
 *
 * The cookie carries only the username; everything else (role, dashboards,
 * customers) is re-hydrated from the DB on every request via getSession() —
 * so revoking a user or changing their permissions takes effect immediately
 * without waiting for cookie expiry.
 *
 * Two cookies in play:
 *  - `wbb_session`   — full authenticated session (set after password + MFA)
 *  - `wbb_mfa`       — short-lived (5 min) challenge cookie set after a
 *                      successful password check on a 2FA-enabled account.
 *                      Holds only `{username, exp}` and is cleared as soon as
 *                      the MFA step succeeds (or the cookie expires).
 *
 * Auth is enforced per page via `requireSession()` in server components — no
 * middleware/proxy is wired up. That keeps every page's runtime in Node so
 * Buffer-based session decoding works without Edge runtime constraints.
 */

export const SESSION_COOKIE = "wbb_session";
export const MFA_CHALLENGE_COOKIE = "wbb_mfa";

const FALLBACK_DEV_SECRET = "wbb-dev-only-secret-change-me-in-prod";
const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;

let warnedAboutSecret = false;

export type SessionUser = {
  username: string;
  name: string;
  email: string;
  company: string;
  /** Customer IDs this user can access. For role=customer, the only allowed
   *  scope; for admin/internal, ignored (they can see everything). */
  customerIds: string[];
  /** Per-customer permission tier (viewer | editor). Customer-role only;
   *  admin and internal are always treated as editor regardless of contents
   *  (see `customerPermissionFor` in lib/customers/registry.ts). */
  customerPermissions: Record<string, CustomerPermission>;
  role: UserRole;
  /** Dashboard IDs from `lib/dashboards/registry.ts`. */
  dashboards: string[];
  /** Optional path under `public/`. Falls back to initials avatar when absent. */
  avatarUrl?: string | null;
  mfaEnabled: boolean;
  /** Per-user "set as homepage" URL (relative path with query). When set,
   *  visiting `/` redirects here instead of the role-based default. */
  homeUrl: string | null;
};

/** Result of a username/password check. The login API maps this into either
 *  a finished session (when MFA isn't on) or a challenge step (when it is). */
export type LoginResult =
  | { kind: "ok"; user: SessionUser }
  | { kind: "mfa-required"; username: string }
  | { kind: "invalid" };

export async function attemptLogin(
  username: string,
  password: string,
): Promise<LoginResult> {
  const u = await authenticateUser(username, password);
  if (!u) return { kind: "invalid" };
  if (u.mfaEnabled) return { kind: "mfa-required", username: u.username };
  return { kind: "ok", user: toSessionUser(u) };
}

export async function createSession(user: SessionUser, remember: boolean) {
  const jar = await cookies();
  const payload = encodeSigned({ username: user.username });
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
  jar.delete(MFA_CHALLENGE_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE);
  if (!cookie) return null;
  const decoded = decodeSigned<{ username: string }>(cookie.value);
  if (!decoded?.username) return null;
  // Always re-hydrate from the store. If the username doesn't match a real
  // user (revoked, deleted), the session is treated as invalid.
  const fresh = await getUser(decoded.username);
  if (!fresh || !fresh.active) return null;
  return toSessionUser(fresh);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (!isAdminRole(user.role)) redirect("/");
  return user;
}

/** Gate for actions only super admins should perform. Today's UI doesn't use
 *  this — both admin tiers manage users — but having the helper available
 *  makes it easy to add super-admin-only buttons later. */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "super_admin") redirect("/");
  return user;
}

/** For pages that need a customer-scoped data source. Customer-role users
 *  with no customers assigned, and internal/admin without a switched-into
 *  customer, are sent home. */
export async function requireCustomerSession(): Promise<
  SessionUser & { customerIds: string[] }
> {
  const user = await requireSession();
  if (user.role === "customer" && user.customerIds.length === 0) redirect("/");
  return user;
}

/**
 * Guard for routes under `/c/[customerId]/...`. Returns the user, the
 * resolved customer, and their effective permission tier when access is
 * allowed; redirects otherwise.
 *
 *  - Customer users may only see customer ids in their `customerIds` list.
 *  - Admin and internal users may see any customer in the registry, always
 *    as 'editor'.
 *  - Unknown customer IDs always redirect home.
 */
export async function requireCustomerAccess(
  customerId: string,
): Promise<{ user: SessionUser; customer: Customer; permission: CustomerPermission }> {
  const user = await requireSession();
  const customer = customerForUser(user, customerId);
  if (!customer) redirect("/");
  const permission = customerPermissionFor(user, customer.id);
  return { user, customer, permission };
}

/**
 * Same as `requireCustomerAccess` but additionally requires editor
 * permission on the customer. Use this from server actions / route handlers
 * that mutate customer-scoped data (e.g. adding a folder or document).
 *
 * Throws (rather than redirects) on failed permission checks so misuse from
 * a non-editor surfaces as an error to the caller instead of silently
 * navigating away from the page that triggered the action.
 */
export async function requireCustomerEditor(
  customerId: string,
): Promise<{ user: SessionUser; customer: Customer }> {
  const { user, customer, permission } = await requireCustomerAccess(customerId);
  if (permission !== "editor") {
    throw new Error("Forbidden: editor permission required for this customer.");
  }
  return { user, customer };
}

// ─── MFA challenge cookie ──────────────────────────────────────────────

export async function setMfaChallenge(username: string, remember: boolean) {
  const jar = await cookies();
  const exp = Math.floor(Date.now() / 1000) + MFA_CHALLENGE_TTL_SECONDS;
  jar.set(MFA_CHALLENGE_COOKIE, encodeSigned({ username, exp, remember }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MFA_CHALLENGE_TTL_SECONDS,
  });
}

export async function readMfaChallenge(): Promise<
  { username: string; remember: boolean } | null
> {
  const jar = await cookies();
  const cookie = jar.get(MFA_CHALLENGE_COOKIE);
  if (!cookie) return null;
  const decoded = decodeSigned<{ username: string; exp: number; remember: boolean }>(
    cookie.value,
  );
  if (!decoded) return null;
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { username: decoded.username, remember: !!decoded.remember };
}

export async function clearMfaChallenge() {
  const jar = await cookies();
  jar.delete(MFA_CHALLENGE_COOKIE);
}

// ─── Re-exports ────────────────────────────────────────────────────────

export { getCustomer };

// ─── Internals ─────────────────────────────────────────────────────────

function toSessionUser(u: {
  username: string;
  name: string;
  email: string;
  company: string;
  customerIds: string[];
  customerPermissions: Record<string, CustomerPermission>;
  role: UserRole;
  dashboards: string[];
  avatarUrl?: string | null;
  mfaEnabled: boolean;
  homeUrl: string | null;
}): SessionUser {
  return {
    username: u.username,
    name: u.name,
    email: u.email,
    company: u.company,
    customerIds: u.customerIds,
    customerPermissions: u.customerPermissions,
    role: u.role,
    dashboards: u.dashboards,
    avatarUrl: u.avatarUrl,
    mfaEnabled: u.mfaEnabled,
    homeUrl: u.homeUrl,
  };
}

function sessionSecret(): string {
  const env = process.env.SESSION_SECRET;
  if (env) return env;
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      "[auth] SESSION_SECRET is unset; using insecure dev fallback. Set this before deploying.",
    );
  }
  return FALLBACK_DEV_SECRET;
}

function encodeSigned(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function decodeSigned<T>(value: string): T | null {
  const idx = value.lastIndexOf(".");
  if (idx <= 0) return null;
  const body = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
