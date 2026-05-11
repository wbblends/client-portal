/**
 * Single-use auth tokens (invite + password reset).
 *
 * - 32 bytes of crypto-random hex.
 * - Bound to a username and a kind (`invite` | `reset`).
 * - Marked `used_at` on consumption — a token can be redeemed at most once.
 * - Expiries: invite = 7 days, reset = 1 hour.
 *
 * Stored verbatim (no hashing). For the threat model of this portal, the
 * token already lives in the email recipient's mailbox in cleartext, so
 * hashing it in the DB doesn't materially raise the bar. If we later move to
 * a HIBP-style breach posture we can hash the column without changing call
 * sites.
 */
import { randomBytes } from "node:crypto";
import { ensureDb } from "@/lib/db";

export type TokenKind = "invite" | "reset";

const TTL_SECONDS: Record<TokenKind, number> = {
  invite: 60 * 60 * 24 * 7, // 7 days
  reset: 60 * 60, // 1 hour
};

export async function createToken(username: string, kind: TokenKind): Promise<string> {
  const client = await ensureDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_SECONDS[kind] * 1000).toISOString();
  // Invalidate any prior unused tokens of the same kind for this user — only
  // the latest invite/reset link should ever work.
  await client.execute({
    sql: `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
           WHERE username = ? AND kind = ? AND used_at IS NULL`,
    args: [username, kind],
  });
  await client.execute({
    sql: `INSERT INTO auth_tokens (token, username, kind, expires_at) VALUES (?, ?, ?, ?)`,
    args: [token, username, kind, expiresAt],
  });
  return token;
}

export type TokenLookup = {
  token: string;
  username: string;
  kind: TokenKind;
};

export async function findValidToken(token: string, kind: TokenKind): Promise<TokenLookup | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT token, username, kind, expires_at, used_at
            FROM auth_tokens
           WHERE token = ? AND kind = ?`,
    args: [token, kind],
  });
  if (rows.length === 0) return null;
  const row = rows[0] as unknown as {
    token: string;
    username: string;
    kind: TokenKind;
    expires_at: string;
    used_at: string | null;
  };
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { token: row.token, username: row.username, kind: row.kind };
}

/** Mark a token used. Call after the action it authorized has succeeded. */
export async function consumeToken(token: string): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?`,
    args: [token],
  });
}
