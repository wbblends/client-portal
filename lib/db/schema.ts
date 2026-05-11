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
  position     INTEGER NOT NULL DEFAULT 0,
  updated_by   TEXT REFERENCES users(username) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_portal_rows_position
  ON orders_portal_rows(position);
`;
