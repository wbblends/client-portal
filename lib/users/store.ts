/**
 * User store — backed by LibSQL/SQLite (see lib/db/).
 *
 * This file is the only place that talks to the `users`, `user_dashboards`,
 * and `user_customers` tables. Everything else (auth, admin UI, etc.)
 * imports from here so that swapping the backing store later means changing
 * exactly this file.
 *
 * Roles:
 *   - admin    — manages users, can switch to any customer's data
 *   - internal — WB Blends staff (board, exec, CS, sales) — switches
 *                customers, no user management
 *   - customer — locked to the customer IDs in their `customerIds` list
 */
import bcrypt from "bcryptjs";
import { ensureDb } from "@/lib/db";

export type UserRole = "admin" | "internal" | "customer";

export type StoredUser = {
  username: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  /** Empty list = customer can't see any customer scope yet. Internal/admin
   *  users see all customers regardless of this list (enforced in callers). */
  customerIds: string[];
  /** Dashboard IDs from `lib/dashboards/registry.ts`. */
  dashboards: string[];
  avatarUrl?: string | null;
  /** False when the user has been invited but hasn't completed first-login
   *  set-password yet. */
  hasPassword: boolean;
  active: boolean;
  mfaEnabled: boolean;
  createdAt: string;
};

const HASH_ROUNDS = 10;

export async function listUsers(): Promise<StoredUser[]> {
  const client = await ensureDb();
  const { rows } = await client.execute(
    `SELECT username, email, name, company, role, password_hash, avatar_url,
            active, mfa_enabled, created_at
       FROM users
       ORDER BY created_at DESC`,
  );
  // Pull permissions in two batched queries instead of N+1 round-trips.
  const usernames = rows.map(r => r.username as string);
  const dashByUser = await fetchManyToMany(
    client,
    "user_dashboards",
    "dashboard_id",
    usernames,
  );
  const custByUser = await fetchManyToMany(
    client,
    "user_customers",
    "customer_id",
    usernames,
  );
  return rows.map(r => rowToUser(r, dashByUser, custByUser));
}

export async function getUser(username: string): Promise<StoredUser | null> {
  const key = username.trim().toLowerCase();
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT username, email, name, company, role, password_hash, avatar_url,
                 active, mfa_enabled, created_at
            FROM users
           WHERE LOWER(username) = ?`,
    args: [key],
  });
  if (rows.length === 0) return null;
  const row = rows[0];
  const dashRows = await client.execute({
    sql: `SELECT dashboard_id FROM user_dashboards WHERE username = ?`,
    args: [row.username as string],
  });
  const custRows = await client.execute({
    sql: `SELECT customer_id FROM user_customers WHERE username = ?`,
    args: [row.username as string],
  });
  return rowToUser(
    row,
    new Map([[row.username as string, dashRows.rows.map(r => r.dashboard_id as string)]]),
    new Map([[row.username as string, custRows.rows.map(r => r.customer_id as string)]]),
  );
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT username FROM users WHERE LOWER(email) = ?`,
    args: [email.trim().toLowerCase()],
  });
  if (rows.length === 0) return null;
  return getUser(rows[0].username as string);
}

/** Returns the user record on success, or `null` for "wrong password / no
 *  such user / inactive / hasn't set password yet". The login flow shouldn't
 *  distinguish between those cases publicly. */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<StoredUser | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT username, password_hash, active
            FROM users
           WHERE LOWER(username) = ?`,
    args: [username.trim().toLowerCase()],
  });
  if (rows.length === 0) return null;
  const { password_hash, active } = rows[0] as {
    username: string;
    password_hash: string | null;
    active: number;
  };
  if (!active) return null;
  if (!password_hash) return null; // invited, hasn't set a password yet
  const ok = await bcrypt.compare(password, password_hash);
  if (!ok) return null;
  return getUser(rows[0].username as string);
}

export type CreateUserInput = {
  username: string;
  email: string;
  name: string;
  company: string;
  role: UserRole;
  customerIds: string[];
  dashboards: string[];
  avatarUrl?: string | null;
};

export async function createUser(input: CreateUserInput): Promise<StoredUser> {
  const client = await ensureDb();
  await client.execute({
    sql: `INSERT INTO users (username, email, name, company, role, avatar_url)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      input.username.trim(),
      input.email.trim(),
      input.name.trim(),
      input.company.trim(),
      input.role,
      input.avatarUrl ?? null,
    ],
  });
  await replacePermissions(input.username, input.customerIds, input.dashboards);
  const u = await getUser(input.username);
  if (!u) throw new Error("createUser: user disappeared after insert");
  return u;
}

export type UpdateUserInput = {
  email?: string;
  name?: string;
  company?: string;
  role?: UserRole;
  customerIds?: string[];
  dashboards?: string[];
  avatarUrl?: string | null;
  active?: boolean;
};

export async function updateUser(username: string, patch: UpdateUserInput): Promise<StoredUser> {
  const client = await ensureDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.email !== undefined) {
    sets.push("email = ?");
    args.push(patch.email.trim());
  }
  if (patch.name !== undefined) {
    sets.push("name = ?");
    args.push(patch.name.trim());
  }
  if (patch.company !== undefined) {
    sets.push("company = ?");
    args.push(patch.company.trim());
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    args.push(patch.role);
  }
  if (patch.avatarUrl !== undefined) {
    sets.push("avatar_url = ?");
    args.push(patch.avatarUrl);
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    args.push(patch.active ? 1 : 0);
  }
  if (sets.length > 0) {
    sets.push("updated_at = CURRENT_TIMESTAMP");
    args.push(username);
    await client.execute({
      sql: `UPDATE users SET ${sets.join(", ")} WHERE username = ?`,
      args,
    });
  }
  if (patch.customerIds !== undefined || patch.dashboards !== undefined) {
    const current = await getUser(username);
    if (!current) throw new Error("updateUser: not found");
    await replacePermissions(
      username,
      patch.customerIds ?? current.customerIds,
      patch.dashboards ?? current.dashboards,
    );
  }
  const u = await getUser(username);
  if (!u) throw new Error("updateUser: not found after update");
  return u;
}

export async function deleteUser(username: string): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM users WHERE username = ?`,
    args: [username],
  });
}

export async function setPassword(username: string, password: string): Promise<void> {
  const client = await ensureDb();
  const hash = await bcrypt.hash(password, HASH_ROUNDS);
  await client.execute({
    sql: `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?`,
    args: [hash, username],
  });
}

export async function setMfa(
  username: string,
  args: { enabled: boolean; secret: string | null; recoveryHashes: string[] | null },
): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE users
             SET mfa_enabled = ?, mfa_secret = ?, mfa_recovery_codes_json = ?,
                 updated_at = CURRENT_TIMESTAMP
           WHERE username = ?`,
    args: [
      args.enabled ? 1 : 0,
      args.secret,
      args.recoveryHashes ? JSON.stringify(args.recoveryHashes) : null,
      username,
    ],
  });
}

export async function getMfaState(username: string): Promise<{
  enabled: boolean;
  secret: string | null;
  recoveryHashes: string[];
} | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT mfa_enabled, mfa_secret, mfa_recovery_codes_json
            FROM users
           WHERE username = ?`,
    args: [username],
  });
  if (rows.length === 0) return null;
  const r = rows[0] as {
    mfa_enabled: number;
    mfa_secret: string | null;
    mfa_recovery_codes_json: string | null;
  };
  let recoveryHashes: string[] = [];
  if (r.mfa_recovery_codes_json) {
    try {
      recoveryHashes = JSON.parse(r.mfa_recovery_codes_json) as string[];
    } catch {
      recoveryHashes = [];
    }
  }
  return {
    enabled: r.mfa_enabled === 1,
    secret: r.mfa_secret,
    recoveryHashes,
  };
}

/** Replace the current MFA recovery code hashes (used to consume one). */
export async function replaceRecoveryHashes(username: string, hashes: string[]): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE users SET mfa_recovery_codes_json = ?, updated_at = CURRENT_TIMESTAMP
           WHERE username = ?`,
    args: [JSON.stringify(hashes), username],
  });
}

async function replacePermissions(
  username: string,
  customerIds: string[],
  dashboards: string[],
): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM user_dashboards WHERE username = ?`,
    args: [username],
  });
  await client.execute({
    sql: `DELETE FROM user_customers WHERE username = ?`,
    args: [username],
  });
  for (const id of dashboards) {
    await client.execute({
      sql: `INSERT INTO user_dashboards (username, dashboard_id) VALUES (?, ?)`,
      args: [username, id],
    });
  }
  for (const id of customerIds) {
    await client.execute({
      sql: `INSERT INTO user_customers (username, customer_id) VALUES (?, ?)`,
      args: [username, id],
    });
  }
}

async function fetchManyToMany(
  client: Awaited<ReturnType<typeof ensureDb>>,
  table: "user_dashboards" | "user_customers",
  valueColumn: "dashboard_id" | "customer_id",
  usernames: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (usernames.length === 0) return out;
  const placeholders = usernames.map(() => "?").join(", ");
  const { rows } = await client.execute({
    sql: `SELECT username, ${valueColumn} FROM ${table} WHERE username IN (${placeholders})`,
    args: usernames,
  });
  for (const r of rows) {
    const u = r.username as string;
    const v = r[valueColumn] as string;
    const list = out.get(u) ?? [];
    list.push(v);
    out.set(u, list);
  }
  return out;
}

function rowToUser(
  row: Record<string, unknown>,
  dashByUser: Map<string, string[]>,
  custByUser: Map<string, string[]>,
): StoredUser {
  const username = row.username as string;
  return {
    username,
    email: row.email as string,
    name: row.name as string,
    company: row.company as string,
    role: row.role as UserRole,
    customerIds: custByUser.get(username) ?? [],
    dashboards: dashByUser.get(username) ?? [],
    avatarUrl: (row.avatar_url as string | null) ?? null,
    hasPassword: row.password_hash !== null,
    active: (row.active as number) === 1,
    mfaEnabled: (row.mfa_enabled as number) === 1,
    createdAt: row.created_at as string,
  };
}
