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
  role                      TEXT NOT NULL CHECK (role IN ('admin', 'internal', 'customer')),
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
  PRIMARY KEY (username, customer_id)
);

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
