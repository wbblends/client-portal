import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

/**
 * On-disk avatar storage. Files live at `<DATA_DIR>/avatars/<userId>.jpg` and
 * are served via the `/api/avatars/[id]` route handler.
 *
 * The cropper component on the client always outputs a 256×256 JPEG, so we
 * only ever store one extension and content-type. Keeping that invariant
 * server-side (re-validate on upload) means the GET handler doesn't have to
 * sniff the file or persist a separate metadata record.
 */

const AVATAR_DIR = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"), "avatars");
const ALLOWED_ID = /^u_[a-z0-9]+$/;

let warnedReadOnly = false;
function warnReadOnlyOnce(err: unknown) {
  if (warnedReadOnly) return;
  warnedReadOnly = true;
  console.warn(
    `[avatars] Could not write to ${AVATAR_DIR} (${err instanceof Error ? err.message : String(err)}). ` +
      `Avatars will not persist. Set DATA_DIR to a writable path to enable.`,
  );
}

function pathFor(userId: string): string | null {
  if (!ALLOWED_ID.test(userId)) return null;
  return join(AVATAR_DIR, `${userId}.jpg`);
}

export function saveAvatar(userId: string, buffer: Buffer): { ok: true } | { ok: false; reason: string } {
  const path = pathFor(userId);
  if (!path) return { ok: false, reason: "Invalid user id." };
  try {
    mkdirSync(AVATAR_DIR, { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, buffer);
    renameSync(tmp, path);
    return { ok: true };
  } catch (err) {
    warnReadOnlyOnce(err);
    return { ok: false, reason: "Could not save image to disk." };
  }
}

export function readAvatar(userId: string): Buffer | null {
  const path = pathFor(userId);
  if (!path || !existsSync(path)) return null;
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

export function deleteAvatar(userId: string): void {
  const path = pathFor(userId);
  if (!path || !existsSync(path)) return;
  try {
    unlinkSync(path);
  } catch (err) {
    warnReadOnlyOnce(err);
  }
}

/** Build the URL the user record stores. Includes a cache-buster. */
export function buildAvatarUrl(userId: string, version: number | string = Date.now()): string {
  return `/api/avatars/${encodeURIComponent(userId)}?v=${encodeURIComponent(String(version))}`;
}
