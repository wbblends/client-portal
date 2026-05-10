/**
 * LibSQL client singleton + first-open schema bootstrap.
 *
 * Why LibSQL: same SQL surface as SQLite, and works on Vercel — `better-sqlite3`
 * needs a writable filesystem which Vercel's Node runtime doesn't provide.
 *
 *  - Local dev (`DATABASE_URL` unset): a file at `data/wbb.db` next to the
 *    project, plus a one-time import from `lib/users/users.json` so the seeded
 *    test users still log in with `password = 'test'`.
 *  - Production: set `DATABASE_URL` to a `libsql://...` URL (Turso, your own
 *    LibSQL server, etc.) and `DATABASE_AUTH_TOKEN` for the bearer token.
 *
 * The schema is applied via `executeMultiple` on first connection. All DDL is
 * `IF NOT EXISTS`, so re-runs are safe.
 */
import { createClient, type Client } from "@libsql/client";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve schema/seed paths from THIS file's location, not process.cwd() —
// the Vercel-style build can run from anywhere, and locally `next dev` is
// sometimes started from a parent directory.
const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..");
const SCHEMA_PATH = join(PROJECT_ROOT, "lib", "db", "schema.sql");
const SEED_USERS_PATH = join(PROJECT_ROOT, "lib", "users", "users.json");
const DEFAULT_DB_DIR = join(PROJECT_ROOT, "data");

let cached: Client | null = null;
let bootstrapped = false;

export function db(): Client {
  if (cached) return cached;
  cached = createClient(connectionConfig());
  return cached;
}

/** Ensures schema exists and seed import has run. Call once per request that
 *  needs the DB; the work after the first call is a single in-memory check. */
export async function ensureDb(): Promise<Client> {
  const client = db();
  if (bootstrapped) return client;
  await applySchema(client);
  await applyMigrations(client);
  await maybeImportSeedUsers(client);
  bootstrapped = true;
  return client;
}

function connectionConfig() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (url) {
    return { url, authToken };
  }
  // Default to a local file under <project>/data/. Make sure the directory
  // exists — it's gitignored, so a fresh checkout won't have it.
  mkdirSync(DEFAULT_DB_DIR, { recursive: true });
  const file = join(DEFAULT_DB_DIR, "wbb.db");
  return { url: `file:${file}` };
}

async function applySchema(client: Client) {
  const sql = readFileSync(SCHEMA_PATH, "utf8");
  await client.executeMultiple(sql);
}

/**
 * In-place migrations for changes that CREATE TABLE IF NOT EXISTS can't
 * handle — e.g. adding a column to a table that already exists locally.
 * Each step is guarded by a PRAGMA check so re-runs are no-ops.
 *
 * If you find yourself adding more than a handful of these, promote this to
 * a real numbered-migration system instead.
 */
async function applyMigrations(client: Client) {
  // 2026-05 — per-customer permission on user_customers (viewer | editor)
  const cols = await client.execute("PRAGMA table_info(user_customers)");
  const hasPermission = cols.rows.some(r => (r.name as string) === "permission");
  if (!hasPermission) {
    await client.execute(
      `ALTER TABLE user_customers
         ADD COLUMN permission TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (permission IN ('viewer', 'editor'))`,
    );
  }
}

/** Import seed users from `lib/users/users.json` the first time we see an
 *  empty `users` table. Lets dev environments boot with the existing test
 *  accounts (passwords are migrated to bcrypt hashes on the way in). */
async function maybeImportSeedUsers(client: Client) {
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM users");
  if ((rows[0]?.n as number) > 0) return;

  if (!existsSync(SEED_USERS_PATH)) return;

  type SeedUser = {
    username: string;
    password: string;
    name: string;
    email: string;
    company: string;
    customerId?: string;
    role: "admin" | "internal" | "customer";
    dashboards: string[];
    avatarUrl?: string;
  };
  const data = JSON.parse(readFileSync(SEED_USERS_PATH, "utf8")) as { users: SeedUser[] };
  const bcrypt = await import("bcryptjs");

  for (const u of data.users ?? []) {
    const hash = await bcrypt.hash(u.password, 10);
    await client.execute({
      sql: `INSERT INTO users (username, email, name, company, role, password_hash, avatar_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [u.username, u.email, u.name, u.company, u.role, hash, u.avatarUrl ?? null],
    });
    for (const dashboardId of u.dashboards ?? []) {
      await client.execute({
        sql: `INSERT INTO user_dashboards (username, dashboard_id) VALUES (?, ?)`,
        args: [u.username, dashboardId],
      });
    }
    if (u.customerId) {
      await client.execute({
        sql: `INSERT INTO user_customers (username, customer_id, permission)
              VALUES (?, ?, 'viewer')`,
        args: [u.username, u.customerId],
      });
    }
  }
}
