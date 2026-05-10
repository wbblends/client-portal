import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readJson, writeJson } from "./persistence";

/**
 * Single-use password reset tokens. The raw token (32 bytes hex) is included
 * in the reset URL given to the user; the store keeps only a scrypt hash so
 * a leaked file is useless. Tokens expire after 24 hours and are consumed
 * (deleted) on use.
 */

const FILE = "reset-tokens.json";
const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_LENGTH = 32;

type StoredToken = {
  id: string;
  userId: string;
  salt: string;
  hash: string;
  createdAt: string;
  expiresAt: string;
  /** Optional metadata for the audit log. */
  createdByActorId?: string | null;
  createdByActorUsername?: string | null;
};

let tokens: StoredToken[] | null = null;

function load(): StoredToken[] {
  if (tokens === null) {
    tokens = readJson<StoredToken[]>(FILE, []);
  }
  return tokens;
}

function save() {
  if (tokens) writeJson(FILE, tokens);
}

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

function purgeExpired() {
  const list = load();
  const now = Date.now();
  const before = list.length;
  tokens = list.filter(t => Date.parse(t.expiresAt) > now);
  if (tokens.length !== before) save();
}

export type CreatedResetToken = {
  /** The opaque value to embed in a URL. Shown to the user once and never stored. */
  rawToken: string;
  expiresAt: string;
};

/**
 * Mint a new reset token for the user. Any existing tokens for that user are
 * invalidated so only the most recent link works.
 */
export function createResetToken(userId: string, actor?: { id?: string; username?: string }): CreatedResetToken {
  purgeExpired();
  const list = load();
  tokens = list.filter(t => t.userId !== userId);
  const id = "rt_" + randomBytes(6).toString("hex");
  const raw = randomBytes(32).toString("hex");
  // Encode userId in the visible token so we can locate the record without scanning.
  const rawToken = `${userId}.${raw}`;
  const { salt, hash } = hashSecret(raw);
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  tokens.push({
    id,
    userId,
    salt,
    hash,
    createdAt: new Date().toISOString(),
    expiresAt,
    createdByActorId: actor?.id ?? null,
    createdByActorUsername: actor?.username ?? null,
  });
  save();
  return { rawToken, expiresAt };
}

/** Returns the userId if the token is valid (and not yet consumed), else null. */
export function peekResetToken(rawToken: string): { userId: string; expiresAt: string } | null {
  purgeExpired();
  const parsed = parseToken(rawToken);
  if (!parsed) return null;
  const list = load();
  const record = list.find(t => t.userId === parsed.userId);
  if (!record) return null;
  if (!verifyHash(parsed.secret, record.salt, record.hash)) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) return null;
  return { userId: record.userId, expiresAt: record.expiresAt };
}

/** Consume the token (single-use). Returns the userId if valid, else null. */
export function consumeResetToken(rawToken: string): string | null {
  const parsed = parseToken(rawToken);
  if (!parsed) return null;
  const list = load();
  const ix = list.findIndex(t => t.userId === parsed.userId);
  if (ix === -1) return null;
  const record = list[ix];
  if (!verifyHash(parsed.secret, record.salt, record.hash)) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    list.splice(ix, 1);
    save();
    return null;
  }
  list.splice(ix, 1);
  save();
  return record.userId;
}

function parseToken(rawToken: string): { userId: string; secret: string } | null {
  const ix = rawToken.indexOf(".");
  if (ix === -1) return null;
  const userId = rawToken.slice(0, ix);
  const secret = rawToken.slice(ix + 1);
  if (!userId || !secret) return null;
  return { userId, secret };
}
