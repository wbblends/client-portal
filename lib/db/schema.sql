-- WB Blends portal database schema.
--
-- Applied automatically the first time `lib/db/index.ts` opens a connection;
-- there is no migration tool yet. Statements are idempotent (CREATE IF NOT
-- EXISTS) so re-running on an existing database is a no-op. When you need a
-- destructive change, add a new numbered migration file and a small runner
-- under lib/db/ — don't edit this file in place after data is in production.

CREATE TABLE IF NOT EXISTS users (
  username                  TEXT PRIMARY KEY,
  email                     TEXT NOT NULL UNIQUE,
  name                      TEXT NOT NULL,
  company                   TEXT NOT NULL,
  role                      TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'internal', 'customer')),
  -- NULL until the user completes their first-login set-password flow.
  password_hash             TEXT,
  avatar_url                TEXT,
  active                    INTEGER NOT NULL DEFAULT 1,
  -- TOTP 2FA. `mfa_secret` is the base32-encoded shared secret; recovery
  -- codes are stored as bcrypt hashes (one JSON array of hashes) so a
  -- read-only DB leak doesn't hand out usable codes.
  mfa_enabled               INTEGER NOT NULL DEFAULT 0,
  mfa_secret                TEXT,
  mfa_recovery_codes_json   TEXT,
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
  -- 'viewer' (read-only) or 'editor' (can add/remove folders + documents
  -- inside this customer's Documents area). Admin and internal roles are
  -- always treated as editor regardless of what's stored here.
  permission  TEXT NOT NULL DEFAULT 'viewer'
              CHECK (permission IN ('viewer', 'editor')),
  PRIMARY KEY (username, customer_id)
);

-- Editor-added folders + documents in a customer's Documents area. Lives
-- alongside the seeded mock tree from `lib/data/documents.ts` (the
-- placeholder data the portal still ships with). Only metadata is stored —
-- there is no blob storage yet, so `download_url` is null and the UI shows a
-- placeholder "coming soon" affordance. Swap this for a real DAM when the
-- rest of the data layer gets wired up to Acumatica / proprietary APIs.
CREATE TABLE IF NOT EXISTS customer_documents (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  parent_id    TEXT,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('folder', 'file')),
  file_type    TEXT,    -- pdf|xlsx|docx|csv|png|jpg|txt; NULL for folders
  size_bytes   INTEGER, -- NULL for folders
  download_url TEXT,    -- NULL until real blob storage lands
  created_by   TEXT REFERENCES users(username) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES customer_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_lookup
  ON customer_documents(customer_id, parent_id);

-- Single-use tokens for invite (initial password set) and forgot-password
-- reset flows. The token is a 32-byte random hex string; we store it
-- verbatim because it's already a high-entropy bearer secret — hashing it
-- would only matter if we expected DB-leak-without-cookie-leak attacks,
-- which isn't our threat model for a portal of this size.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token       TEXT PRIMARY KEY,
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('invite', 'reset')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_username ON auth_tokens(username);

-- Figma-style page comments. A `comment_threads` row is a pin on the page; the
-- pin lives at (anchor_x_pct, anchor_y_px) within the route's <main>. Replies
-- and the original message both live in `comments`, joined to a thread by
-- `thread_id`. Anchoring is fraction-of-width horizontally (responsive) and
-- pixel-offset-from-top vertically (so content reflows above don't drag the
-- pin out of place).
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

-- Resolved @-mentions. Stored alongside the comment so the email-on-mention
-- worker has an exact set of recipients (the body itself can be edited later).
CREATE TABLE IF NOT EXISTS comment_mentions (
  comment_id  TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, username)
);

-- Orders Portal rows — see lib/db/schema.ts (the bundled string is the
-- runtime source of truth; this file is mirrored for human reading).
CREATE TABLE IF NOT EXISTS orders_portal_rows (
  id           TEXT PRIMARY KEY,
  customer     TEXT NOT NULL DEFAULT '',
  rep          TEXT NOT NULL DEFAULT '',
  cs           TEXT NOT NULL DEFAULT '',
  tier         TEXT NOT NULL DEFAULT ''
               CHECK (tier IN ('', 'AA', 'A', 'B', 'C')),
  projection   REAL NOT NULL DEFAULT 0,
  months_json  TEXT NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null,null,null,null]',
  position     INTEGER NOT NULL DEFAULT 0,
  updated_by   TEXT REFERENCES users(username) ON DELETE SET NULL,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_portal_rows_position
  ON orders_portal_rows(position);
