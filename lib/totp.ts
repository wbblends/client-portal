import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP with HMAC-SHA1, 6-digit codes, 30-second window. Compatible
 * with Google Authenticator, 1Password, Authy, Microsoft Authenticator, etc.
 *
 * No external dependency — implemented over `node:crypto`. Secrets are
 * exchanged in RFC 4648 base32 (uppercase, no padding) which is what the
 * `otpauth://` URI scheme expects.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept a code from the previous, current, or next 30s window for clock skew. */
const WINDOW_DRIFT = 1;

export function generateBase32Secret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // counter is at most ~2^33 for the next 100 years; high half stays zero.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (binCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
  return code;
}

export function generateTotp(secretBase32: string, when: Date = new Date()): string {
  const counter = Math.floor(when.getTime() / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

export function verifyTotp(secretBase32: string, code: string, when: Date = new Date()): boolean {
  const trimmed = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const key = base32Decode(secretBase32);
  const counter = Math.floor(when.getTime() / 1000 / STEP_SECONDS);
  const candidate = Buffer.from(trimmed, "utf8");
  for (let drift = -WINDOW_DRIFT; drift <= WINDOW_DRIFT; drift++) {
    const expected = Buffer.from(hotp(key, counter + drift), "utf8");
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return true;
    }
  }
  return false;
}

/** Build the `otpauth://` URI used by authenticator apps. */
export function buildOtpAuthUrl(opts: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Format a base32 secret for human entry: groups of 4, hyphen-separated. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Generate human-friendly recovery codes (10 codes, 10 chars each, hyphenated). */
export function generateRecoveryCodes(count = 10): string[] {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = randomBytes(10);
    let s = "";
    for (let j = 0; j < 10; j++) s += chars[buf[j] % chars.length];
    out.push(s.slice(0, 5) + "-" + s.slice(5));
  }
  return out;
}
