import Database, { type Database as DatabaseT } from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

/**
 * SQLite-backed persistence for chat. The DB lives at ./data/app.db (gitignored)
 * and is opened lazily per process. better-sqlite3 is synchronous which is fine
 * for our workload (small per-request reads/writes) and avoids serverless cold-
 * start gotchas of async drivers.
 *
 * Note for production: Vercel functions don't share a writable filesystem
 * between invocations. To deploy on Vercel, swap this module for Vercel KV /
 * Postgres / Turso while keeping the same query helpers in lib/chat/repository.ts.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

let _db: DatabaseT | null = null;

export function db(): DatabaseT {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  seedIfEmpty(conn);
  _db = conn;
  return conn;
}

export function uploadDir(): string {
  // Ensure the upload dir exists even if db() hasn't been called this tick.
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return UPLOAD_DIR;
}

function migrate(conn: DatabaseT) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('super_admin','internal','external')),
      customer_id TEXT REFERENCES customers(id),
      company TEXT,
      avatar_url TEXT,
      avatar_color TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('dm','group','channel')),
      title TEXT,
      customer_id TEXT REFERENCES customers(id),
      dm_key TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_message_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conv_customer ON conversations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_conv_last_message ON conversations(last_message_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_dm_key ON conversations(dm_key) WHERE dm_key IS NOT NULL;

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_member_user ON conversation_members(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_msg_conv_created ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attach_msg ON attachments(message_id);
  `);
}

function seedIfEmpty(conn: DatabaseT) {
  const row = conn.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  if (row.c > 0) return;

  const now = Date.now();

  const insertCustomer = conn.prepare(
    "INSERT INTO customers (id, name) VALUES (?, ?)",
  );
  const insertUser = conn.prepare(
    `INSERT INTO users (id, username, password, name, email, role, customer_id, company, avatar_url, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertConv = conn.prepare(
    `INSERT INTO conversations (id, type, title, customer_id, dm_key, created_by, created_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMember = conn.prepare(
    `INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at)
     VALUES (?, ?, ?, ?)`,
  );
  const insertMessage = conn.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  conn.transaction(() => {
    insertCustomer.run("C-1042", "Devin's Test Brand");
    insertCustomer.run("C-2090", "Northwind Beverages");

    // Existing demo user (preserved) + a small cast for multi-party chat demos.
    const seedUsers: Array<{
      id: string;
      username: string;
      password: string;
      name: string;
      email: string;
      role: "super_admin" | "internal" | "external";
      customerId: string | null;
      company: string;
      avatarUrl?: string;
      avatarColor: string;
    }> = [
      {
        id: "U-dsimmons",
        username: "dsimmons",
        password: "test",
        name: "Devin Simmons",
        email: "devin@devinstest.example",
        role: "external",
        customerId: "C-1042",
        company: "Devin's Test Brand",
        avatarUrl: "/avatars/dsimmons.jpg",
        avatarColor: "#7d5bfe",
      },
      {
        id: "U-sosa",
        username: "sosa",
        password: "test",
        name: "Sam Osa",
        email: "sosa@wbblends.example",
        role: "super_admin",
        customerId: null,
        company: "WB Blends",
        avatarColor: "#0e8a5d",
      },
      {
        id: "U-rwalsh",
        username: "rwalsh",
        password: "test",
        name: "Rita Walsh",
        email: "rita@wbblends.example",
        role: "internal",
        customerId: null,
        company: "WB Blends",
        avatarColor: "#b45309",
      },
      {
        id: "U-jchen",
        username: "jchen",
        password: "test",
        name: "Jordan Chen",
        email: "jordan@wbblends.example",
        role: "internal",
        customerId: null,
        company: "WB Blends",
        avatarColor: "#4338ca",
      },
      {
        id: "U-mhill",
        username: "mhill",
        password: "test",
        name: "Maya Hill",
        email: "maya@devinstest.example",
        role: "external",
        customerId: "C-1042",
        company: "Devin's Test Brand",
        avatarColor: "#b91c1c",
      },
      {
        id: "U-tking",
        username: "tking",
        password: "test",
        name: "Theo King",
        email: "theo@northwindbev.example",
        role: "external",
        customerId: "C-2090",
        company: "Northwind Beverages",
        avatarColor: "#0369a1",
      },
    ];

    for (const u of seedUsers) {
      insertUser.run(
        u.id,
        u.username,
        u.password,
        u.name,
        u.email,
        u.role,
        u.customerId,
        u.company,
        u.avatarUrl ?? null,
        u.avatarColor,
        now,
      );
    }

    // Per-customer channel for each customer, members include super admin +
    // all WB internal users + all external users from that customer.
    const internalAndAdmin = seedUsers.filter(u => u.role !== "external");
    const externalsByCustomer = new Map<string, typeof seedUsers>();
    for (const u of seedUsers) {
      if (u.role === "external" && u.customerId) {
        const list = externalsByCustomer.get(u.customerId) ?? [];
        list.push(u);
        externalsByCustomer.set(u.customerId, list);
      }
    }

    const customers: Array<{ id: string; name: string }> = [
      { id: "C-1042", name: "Devin's Test Brand" },
      { id: "C-2090", name: "Northwind Beverages" },
    ];
    for (const c of customers) {
      const channelId = `CH-${c.id}`;
      insertConv.run(
        channelId,
        "channel",
        `${c.name} channel`,
        c.id,
        null,
        "U-sosa",
        now,
        now,
      );
      const members = [
        ...internalAndAdmin,
        ...(externalsByCustomer.get(c.id) ?? []),
      ];
      for (const m of members) {
        insertMember.run(channelId, m.id, now, 0);
      }
      // A welcome message so the channel isn't empty.
      const msgId = `M-${channelId}-1`;
      insertMessage.run(
        msgId,
        channelId,
        "U-sosa",
        `Welcome to the ${c.name} channel. WB Blends and ${c.name} contacts can collaborate here.`,
        now,
      );
    }

    // Seed one DM between Devin and Jordan so the demo has a non-channel chat.
    const dmKey = makeDmKey("U-dsimmons", "U-jchen");
    const dmId = "DM-dsimmons-jchen";
    insertConv.run(dmId, "dm", null, null, dmKey, "U-jchen", now, now);
    insertMember.run(dmId, "U-dsimmons", now, 0);
    insertMember.run(dmId, "U-jchen", now, 0);
    insertMessage.run(
      "M-DM-1",
      dmId,
      "U-jchen",
      "Hey Devin — flagging the new SKU pricing for next week's call.",
      now,
    );
  })();
}

export function makeDmKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
