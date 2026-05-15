// WB Blends portal database schema.
//
// Inlined as a string (rather than reading schema.sql at runtime) so the
// Next.js serverless bundle on Vercel doesn't have to ship a separate .sql
// file. Edit the SQL here; statements remain idempotent (CREATE IF NOT
// EXISTS) so re-running on an existing database is a no-op.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  username                  TEXT PRIMARY KEY,
  email                     TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  company                   TEXT NOT NULL,
  role                      TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'internal', 'customer')),
  password_hash             TEXT,
  avatar_url                TEXT,
  active                    INTEGER NOT NULL DEFAULT 1,
  mfa_enabled               INTEGER NOT NULL DEFAULT 0,
  mfa_secret                TEXT,
  mfa_recovery_codes_json   TEXT,
  home_url                  TEXT,
  created_at                TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_dashboards (
  username     TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  dashboard_id TEXT NOT NULL,
  PRIMARY KEY (username, dashboard_id)
);

CREATE TABLE IF NOT EXISTS user_customers (
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  permission  TEXT NOT NULL DEFAULT 'viewer'
              CHECK (permission IN ('viewer', 'editor')),
  PRIMARY KEY (username, customer_id)
);

CREATE TABLE IF NOT EXISTS customer_documents (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  parent_id    TEXT,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('folder', 'file')),
  file_type    TEXT,
  size_bytes   INTEGER,
  download_url TEXT,
  created_by   TEXT REFERENCES users(username) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES customer_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_lookup
  ON customer_documents(customer_id, parent_id);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token       TEXT PRIMARY KEY,
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('invite', 'reset')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_username ON auth_tokens(username);

CREATE TABLE IF NOT EXISTS comment_threads (
  id            TEXT PRIMARY KEY,
  route         TEXT NOT NULL,
  anchor_x_pct  REAL NOT NULL,
  anchor_y_px   REAL NOT NULL,
  resolved      INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comment_threads_route ON comment_threads(route);

CREATE TABLE IF NOT EXISTS comments (
  id              TEXT PRIMARY KEY,
  thread_id       TEXT NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  author_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  edited          INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);

CREATE TABLE IF NOT EXISTS comment_mentions (
  comment_id  TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, username)
);

-- In-app notifications. Today only 'mention' is produced (when someone @s
-- you in a comment), but the type column leaves room for future kinds
-- (replies, resolves, etc) without a migration. comment_id / thread_id /
-- route are denormalised so a notification stays clickable even after the
-- underlying comment is deleted (the FK ON DELETE SET NULL keeps the row
-- but the link gracefully degrades). read_at is null while unread; the
-- index orders by it so the unread fetch is a cheap prefix scan.
CREATE TABLE IF NOT EXISTS notifications (
  id                 TEXT PRIMARY KEY,
  recipient_username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  type               TEXT NOT NULL DEFAULT 'mention'
                     CHECK (type IN ('mention')),
  actor_username     TEXT REFERENCES users(username) ON DELETE SET NULL,
  comment_id         TEXT REFERENCES comments(id) ON DELETE SET NULL,
  thread_id          TEXT REFERENCES comment_threads(id) ON DELETE SET NULL,
  route              TEXT NOT NULL,
  excerpt            TEXT NOT NULL DEFAULT '',
  read_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_username, read_at, created_at DESC);

-- Orders Portal rows. One row per customer-year line, mirroring the in-grid
-- spreadsheet shape. Edits made by any admin become visible to every other
-- user the next time their grid polls. The 12 monthly values are stored as a
-- JSON array (sparse — null slots render as blank). On the first connection
-- to an empty table, the API seed-imports ORDERS_PORTAL_SEED so existing
-- environments still come up with the 2026 PO snapshot.
CREATE TABLE IF NOT EXISTS orders_portal_rows (
  id           TEXT PRIMARY KEY,
  customer     TEXT NOT NULL DEFAULT '',
  rep          TEXT NOT NULL DEFAULT '',
  cs           TEXT NOT NULL DEFAULT '',
  tier         TEXT NOT NULL DEFAULT ''
               CHECK (tier IN ('', 'AA', 'A', 'B', 'C')),
  projection   REAL NOT NULL DEFAULT 0,
  -- 12-element JSON array of (number | null), Jan..Dec.
  months_json  TEXT NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null,null,null]',
  -- Parallel 12-element JSON array of (number | null) holding the rolling
  -- forecast values the grid surfaces in its yellow forecast columns.
  forecasts_json TEXT NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null,null,null]',
  position     INTEGER NOT NULL DEFAULT 0,
  updated_by   TEXT REFERENCES users(username) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_portal_rows_position
  ON orders_portal_rows(position);

-- Tickets imported daily by the 7 AM coworker job. The coworker generates an
-- xlsx in cloud storage AND POSTs the parsed rows to /api/tickets/sync; this
-- table is the portal-side mirror. rank + color are user-owned annotations
-- that survive each sync (the upsert never overwrites them).
CREATE TABLE IF NOT EXISTS tickets (
  -- Composite key. The same logical ticket can be in flight on more than one
  -- workflow at a time (e.g. a ticket sitting in both Document Request and
  -- Label Review), so (tab, id) — not id alone — is what makes a row unique.
  tab             TEXT NOT NULL,
  id              TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL DEFAULT '',
  product_type    TEXT NOT NULL DEFAULT '',
  customer        TEXT NOT NULL DEFAULT '',
  salesperson     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT '',
  open_date       TEXT,
  due_date        TEXT,
  color           TEXT CHECK (color IN ('red', 'white', 'gray') OR color IS NULL),
  rank            INTEGER,
  last_synced_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TEXT,
  PRIMARY KEY (tab, id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_tab ON tickets(tab);
CREATE INDEX IF NOT EXISTS idx_tickets_rank ON tickets(tab, rank);
`;
