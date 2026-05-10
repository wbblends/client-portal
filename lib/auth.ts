import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Session + credential auth for the customer portal.
 *
 * Sessions are stateless cookies of the form `<payload>.<sig>`, where:
 *   - payload = base64url(JSON({ u, c, iat, exp, nonce }))
 *   - sig     = base64url(HMAC-SHA256(SESSION_SECRET, payload))
 *
 * Only the username (`u`) and customer id (`c`) are signed into the cookie.
 * Profile fields (name/email/company/avatar) are re-derived server-side from
 * the seeded user store on every request, so a forged-but-unsigned cookie
 * cannot inject arbitrary identity, and a tampered cookie fails HMAC
 * verification before any data lookup happens.
 *
 * Passwords are stored as `scrypt(salt + password)` and compared with
 * timingSafeEqual. The seeded user's hash was generated with this same
 * routine; rotate it by setting `WBB_SEED_HASH` to a new `salt:hash` pair.
 */

export const SESSION_COOKIE = "wbb_session";

const SESSION_TTL_DEFAULT_SECONDS = 60 * 60 * 8;
const SESSION_TTL_REMEMBER_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  username: string;
  name: string;
  email: string;
  company: string;
  customerId: string;
  /** Optional path under `public/`. Falls back to initials avatar when absent. */
  avatarUrl?: string;
};

type SessionToken = {
  u: string; // username
  c: string; // customer id
  iat: number; // issued-at (seconds)
  exp: number; // expires-at (seconds)
  n: string; // nonce — defends against accidental token reuse across rotations
};

type StoredCredential = {
  /** `salt:hash`, both hex. Salt is 16 bytes, hash is 64 bytes (scrypt N=16384). */
  passwordHash: string;
  user: SessionUser;
};

const SEEDED_USER_PROFILES: Record<string, SessionUser> = {
  dsimmons: {
    username: "dsimmons",
    name: "Devin Simmons",
    email: "devin@devinstest.example",
    company: "Devin's Test Brand",
    customerId: "C-1042",
    avatarUrl: "/avatars/dsimmons.jpg",
  },
};

/**
 * Seed password resolution, evaluated lazily on the first auth attempt so
 * `next build` (which runs route modules at NODE_ENV=production) doesn't
 * trip the no-default-password guard.
 *
 *   1. WBB_SEED_HASH = "<salt-hex>:<hash-hex>" — preferred for production.
 *   2. WBB_SEED_PASSWORD = "..." — hashed in-process on first use.
 *   3. fallback "test" only in non-production, so the demo login keeps working.
 *
 * In production, throws on the first sign-in attempt if neither (1) nor (2)
 * is configured — failing the request rather than ever accepting the demo
 * password.
 */
let cachedSeededUsers: Record<string, StoredCredential> | null = null;
function getSeededUsers(): Record<string, StoredCredential> {
  if (cachedSeededUsers) return cachedSeededUsers;
  const passwordHash = resolveSeedHash();
  cachedSeededUsers = {
    dsimmons: { passwordHash, user: SEEDED_USER_PROFILES.dsimmons },
  };
  return cachedSeededUsers;
}

function resolveSeedHash(): string {
  if (process.env.WBB_SEED_HASH) return process.env.WBB_SEED_HASH;
  if (process.env.WBB_SEED_PASSWORD) return hashPassword(process.env.WBB_SEED_PASSWORD);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "WBB_SEED_PASSWORD or WBB_SEED_HASH env var is required in production. " +
        "The default demo password is not allowed for production deployments.",
    );
  }
  return hashPassword("test");
}

/**
 * Stable dummy hash used as the comparison target for unknown usernames so
 * authenticate() runs scrypt regardless of whether the user exists. Lazy so
 * the random generation doesn't happen at module load (and thus during build).
 */
let dummyAuthHash: string | null = null;
function getDummyAuthHash(): string {
  if (!dummyAuthHash) dummyAuthHash = hashPassword(randomBytes(16).toString("hex"));
  return dummyAuthHash;
}

export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const key = username.trim().toLowerCase();
  const entry = getSeededUsers()[key];
  // Always run a scrypt so authenticate() takes the same wall-clock time
  // whether or not the username exists — defends against user enumeration.
  const reference = entry?.passwordHash ?? getDummyAuthHash();
  const ok = verifyPassword(password, reference);
  if (!entry || !ok) return null;
  return entry.user;
}

export async function createSession(user: SessionUser, remember: boolean) {
  const ttl = remember ? SESSION_TTL_REMEMBER_SECONDS : SESSION_TTL_DEFAULT_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const token: SessionToken = {
    u: user.username,
    c: user.customerId,
    iat: now,
    exp: now + ttl,
    n: randomBytes(8).toString("base64url"),
  };
  const cookie = signToken(token);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ttl,
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
  const token = verifyToken(cookie.value);
  if (!token) return null;
  // Resolve profile from server-side store; the cookie is only trusted for
  // identity, never for attribute values like name/email/company. Pull from
  // the profile-only map so reading a session never triggers password-seed
  // resolution (which can throw in production when env vars are missing).
  const profile = SEEDED_USER_PROFILES[token.u];
  if (!profile || profile.customerId !== token.c) return null;
  return profile;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

// ---------- internals ----------

function getSessionSecret(): Buffer {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return Buffer.from(fromEnv, "utf8");
  if (process.env.NODE_ENV === "production") {
    // Fail loud rather than silently signing with a known/weak key.
    throw new Error(
      "SESSION_SECRET env var is required in production (>= 32 chars). " +
        "Set it in your hosting provider before deploying.",
    );
  }
  // Dev fallback: stable per-process secret so HMR doesn't invalidate sessions
  // every reload, but rotates whenever the dev server restarts.
  return getDevSecret();
}

let devSecret: Buffer | null = null;
function getDevSecret(): Buffer {
  if (!devSecret) {
    // Derived deterministically from cwd so server-component and route-handler
    // module contexts (which dev tools sometimes load separately) agree on the
    // same secret. NOT secure for production use — production requires the
    // real SESSION_SECRET env var.
    devSecret = createHash("sha256")
      .update("wbb-dev-session-secret-v1")
      .update(process.cwd())
      .digest();
    console.warn(
      "[auth] SESSION_SECRET not set — using a derived dev secret. " +
        "Set SESSION_SECRET in production.",
    );
  }
  return devSecret;
}

function signToken(token: SessionToken): string {
  const payload = Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(value: string): SessionToken | null {
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const expected = createHmac("sha256", getSessionSecret()).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isSessionToken(parsed)) return null;
  if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

function isSessionToken(v: unknown): v is SessionToken {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.u === "string" &&
    typeof o.c === "string" &&
    typeof o.iat === "number" &&
    typeof o.exp === "number" &&
    typeof o.n === "string"
  );
}

function verifyPassword(password: string, stored: string): boolean {
  const idx = stored.indexOf(":");
  if (idx <= 0) return false;
  const saltHex = stored.slice(0, idx);
  const hashHex = stored.slice(idx + 1);
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * One-shot helper for generating new credential records — not used at runtime.
 * Run with `node --eval "require('./lib/auth').hashPassword('mypassword')"`
 * after a build, or call from a one-off script. Returns `salt:hash` hex.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}
