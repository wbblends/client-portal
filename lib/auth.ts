import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Demo-only auth. A single seeded user is hardcoded. Sessions are stored as a
 * base64-encoded JSON cookie — adequate for a placeholder portal so the user
 * can log in as a test account, but obviously not safe for production.
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
/**
 * Long-lived cookie that survives logout so the login page can greet a
 * returning user by name. Stores only the first name — no auth value.
 */
export const LAST_USER_COOKIE = "wbb_last_user";

export type SessionUser = {
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  /** Optional path under `public/`. Falls back to initials avatar when absent. */
  avatarUrl?: string;
};

const SEEDED_USERS: Record<string, { password: string; user: SessionUser }> = {
  dsimmons: {
    password: "test",
    user: {
      username: "dsimmons",
      name: "Devin Simmons",
      email: "devin@devinstest.example",
      company: "Devin's Test Brand",
      customerId: "C-1042",
      avatarUrl: "/avatars/dsimmons.jpg",
    },
  },
};

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const entry = SEEDED_USERS[username.trim().toLowerCase()];
  if (!entry || entry.password !== password) return null;
  return entry.user;
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
  const firstName = user.name.split(" ")[0] ?? user.username;
  jar.set(LAST_USER_COOKIE, firstName, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function getLastUserFirstName(): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.get(LAST_USER_COOKIE);
  if (!cookie?.value) return null;
  // Trim and strip anything that isn't a sensible name character so a tampered
  // cookie can't inject markup into the login page.
  const cleaned = cookie.value.trim().replace(/[^\p{L}\p{M}'\-\. ]/gu, "");
  return cleaned.length > 0 ? cleaned.slice(0, 40) : null;
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

function encodePayload(user: SessionUser): string {
  // Buffer is available because proxy/route handlers run in Node runtime.
  return Buffer.from(JSON.stringify(user)).toString("base64url");
}

function decodePayload(value: string): SessionUser | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj?.username === "string" && typeof obj?.customerId === "string") {
      return obj as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}
