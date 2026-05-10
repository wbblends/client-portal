import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Demo-grade persistence: JSON files under `/data/`. Every mutation rewrites
 * the file atomically (write to a tempfile, fsync, rename). Adequate for a
 * single-process dev portal; replace with a real DB before any concurrency.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const CUSTOMERS_PATH = path.join(DATA_DIR, "customers.json");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const INVITES_PATH = path.join(DATA_DIR, "invites.json");

export type StoredCustomer = {
  id: string;
  name: string;
  email: string;
  primaryContact: string;
  phone: string;
  websiteUrl: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  accountSince: number;
};

export type Role = "super_admin" | "customer_admin" | "customer_user";

export const DEFAULT_CUSTOMER_PERMISSIONS = [
  "dashboard",
  "documents",
  "invoices",
  "quality",
  "contact",
] as const;

export type StoredUser = {
  username: string;
  password: string;
  name: string;
  email: string;
  customerId: string;
  role: Role;
  permissions: string[];
  avatarUrl?: string;
};

export type StoredInvite = {
  token: string;
  customerId: string;
  name: string;
  email: string;
  createdAt: number;
  expiresAt: number;
};

type CustomersFile = { customers: StoredCustomer[] };
type UsersFile = { users: StoredUser[] };
type InvitesFile = { invites: StoredInvite[] };

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await fs.rename(tmp, file);
}

// --- Customers ---------------------------------------------------------

export async function listCustomers(): Promise<StoredCustomer[]> {
  const file = await readJson<CustomersFile>(CUSTOMERS_PATH, { customers: [] });
  return file.customers;
}

export async function getCustomer(id: string): Promise<StoredCustomer | null> {
  const customers = await listCustomers();
  return customers.find(c => c.id === id) ?? null;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Omit<StoredCustomer, "id">>,
): Promise<StoredCustomer> {
  const file = await readJson<CustomersFile>(CUSTOMERS_PATH, { customers: [] });
  const idx = file.customers.findIndex(c => c.id === id);
  if (idx < 0) throw new Error(`Customer ${id} not found`);
  file.customers[idx] = { ...file.customers[idx], ...patch, id };
  await writeJson(CUSTOMERS_PATH, file);
  return file.customers[idx];
}

// --- Users -------------------------------------------------------------

export async function listUsers(): Promise<StoredUser[]> {
  const file = await readJson<UsersFile>(USERS_PATH, { users: [] });
  return file.users;
}

export async function getUserByUsername(username: string): Promise<StoredUser | null> {
  const users = await listUsers();
  const u = username.trim().toLowerCase();
  return users.find(x => x.username.toLowerCase() === u) ?? null;
}

export async function listUsersForCustomer(customerId: string): Promise<StoredUser[]> {
  const users = await listUsers();
  return users.filter(u => u.customerId === customerId);
}

export async function createUser(user: StoredUser): Promise<StoredUser> {
  const file = await readJson<UsersFile>(USERS_PATH, { users: [] });
  const existing = file.users.find(
    u => u.username.toLowerCase() === user.username.toLowerCase(),
  );
  if (existing) throw new Error(`Username ${user.username} already exists`);
  file.users.push(user);
  await writeJson(USERS_PATH, file);
  return user;
}

// --- Invites -----------------------------------------------------------

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function listInvitesForCustomer(customerId: string): Promise<StoredInvite[]> {
  const file = await readJson<InvitesFile>(INVITES_PATH, { invites: [] });
  const now = Date.now();
  return file.invites.filter(i => i.customerId === customerId && i.expiresAt > now);
}

export async function createInvite(input: {
  customerId: string;
  name: string;
  email: string;
}): Promise<StoredInvite> {
  const file = await readJson<InvitesFile>(INVITES_PATH, { invites: [] });
  const now = Date.now();
  const invite: StoredInvite = {
    token: randomUUID(),
    customerId: input.customerId,
    name: input.name,
    email: input.email,
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  };
  // Prune expired invites while we're here.
  file.invites = file.invites.filter(i => i.expiresAt > now);
  file.invites.push(invite);
  await writeJson(INVITES_PATH, file);
  return invite;
}

export async function consumeInvite(token: string): Promise<StoredInvite | null> {
  const file = await readJson<InvitesFile>(INVITES_PATH, { invites: [] });
  const now = Date.now();
  const idx = file.invites.findIndex(i => i.token === token && i.expiresAt > now);
  if (idx < 0) return null;
  const [invite] = file.invites.splice(idx, 1);
  await writeJson(INVITES_PATH, file);
  return invite;
}
