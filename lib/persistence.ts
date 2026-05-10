import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Tiny JSON file persistence. Used by the user store, audit log, and reset
 * tokens. Atomic writes via temp-file-then-rename, with graceful no-op if the
 * target FS is read-only (e.g. Vercel serverless) — the in-memory data still
 * works for the lifetime of the process and a single warning is logged.
 *
 * Override the data directory with the `DATA_DIR` environment variable when
 * deploying to a host with persistent disk. Defaults to `./.data`.
 */

const DATA_DIR = resolve(process.env.DATA_DIR || join(process.cwd(), ".data"));

let warnedReadOnly = false;

function warnReadOnlyOnce(filename: string, err: unknown) {
  if (warnedReadOnly) return;
  warnedReadOnly = true;
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(
    `[persistence] Could not write ${filename} (${detail}). ` +
      `Continuing in memory-only mode. Set DATA_DIR to a writable path to enable persistence.`,
  );
}

export function readJson<T>(filename: string, fallback: T): T {
  const path = join(DATA_DIR, filename);
  try {
    if (!existsSync(path)) return fallback;
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(
      `[persistence] Could not read ${filename}: ${err instanceof Error ? err.message : String(err)}. Using fallback.`,
    );
    return fallback;
  }
}

export function writeJson(filename: string, value: unknown): void {
  const path = join(DATA_DIR, filename);
  const payload = JSON.stringify(value, null, 2);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, payload, "utf8");
    renameSync(tmp, path);
  } catch (err) {
    warnReadOnlyOnce(filename, err);
  }
}

/** Append a single record to a JSON-lines file. Used for audit events. */
export function appendJsonLine(filename: string, record: unknown): void {
  const path = join(DATA_DIR, filename);
  try {
    mkdirSync(dirname(path), { recursive: true });
    const line = JSON.stringify(record) + "\n";
    // appendFileSync is atomic enough for our single-process demo.
    // For multi-process writers, switch to per-record locking.
    appendFileSync(path, line, "utf8");
  } catch (err) {
    warnReadOnlyOnce(filename, err);
  }
}

export function readJsonLines<T>(filename: string): T[] {
  const path = join(DATA_DIR, filename);
  try {
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, "utf8");
    if (!raw.trim()) return [];
    return raw
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line) as T);
  } catch (err) {
    console.warn(
      `[persistence] Could not read ${filename}: ${err instanceof Error ? err.message : String(err)}. Returning empty.`,
    );
    return [];
  }
}
