/**
 * Comments store — Figma-style page comments.
 *
 * A `Thread` is a pin on a page (route + anchor coords). Threads contain one
 * or more `Comment` rows: the first is the original message, the rest are
 * replies. Mentions are resolved at write-time and stored per-comment so the
 * email worker has a deterministic recipient list even if the body is later
 * edited.
 *
 * Only the `comments`, `comment_threads`, and `comment_mentions` tables are
 * touched here — every other layer (API routes, client overlay) goes through
 * this module.
 */
import { randomUUID } from "node:crypto";
import { ensureDb } from "@/lib/db";

export type CommentAuthor = {
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type Comment = {
  id: string;
  threadId: string;
  author: CommentAuthor;
  body: string;
  mentions: string[]; // usernames
  edited: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Thread = {
  id: string;
  route: string;
  anchorXPct: number;
  anchorYPx: number;
  resolved: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
};

export type MentionableUser = {
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

/** All threads (with comments) for a route. Includes resolved threads — the
 *  client filters them out by default behind a "show resolved" toggle. */
export async function listThreadsForRoute(route: string): Promise<Thread[]> {
  const client = await ensureDb();
  const { rows: tRows } = await client.execute({
    sql: `SELECT id, route, anchor_x_pct, anchor_y_px, resolved, created_by,
                 created_at, updated_at
            FROM comment_threads
           WHERE route = ?
           ORDER BY created_at ASC`,
    args: [route],
  });
  if (tRows.length === 0) return [];
  const threadIds = tRows.map(r => r.id as string);
  const comments = await fetchCommentsForThreads(threadIds);
  return tRows.map(r => ({
    id: r.id as string,
    route: r.route as string,
    anchorXPct: Number(r.anchor_x_pct),
    anchorYPx: Number(r.anchor_y_px),
    resolved: (r.resolved as number) === 1,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    comments: comments.get(r.id as string) ?? [],
  }));
}

export async function getThread(id: string): Promise<Thread | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT id, route, anchor_x_pct, anchor_y_px, resolved, created_by,
                 created_at, updated_at
            FROM comment_threads WHERE id = ?`,
    args: [id],
  });
  if (rows.length === 0) return null;
  const r = rows[0];
  const comments = await fetchCommentsForThreads([id]);
  return {
    id: r.id as string,
    route: r.route as string,
    anchorXPct: Number(r.anchor_x_pct),
    anchorYPx: Number(r.anchor_y_px),
    resolved: (r.resolved as number) === 1,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    comments: comments.get(id) ?? [],
  };
}

export type CreateThreadInput = {
  route: string;
  anchorXPct: number;
  anchorYPx: number;
  body: string;
  authorUsername: string;
  mentions: string[];
};

/** Creates a thread and its first comment in one go. Returns the thread id
 *  + the new comment id (for highlighting / scroll-to). */
export async function createThread(input: CreateThreadInput): Promise<{
  threadId: string;
  commentId: string;
}> {
  const client = await ensureDb();
  const threadId = randomUUID();
  const commentId = randomUUID();
  await client.execute({
    sql: `INSERT INTO comment_threads
            (id, route, anchor_x_pct, anchor_y_px, created_by)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      threadId,
      input.route,
      clamp01(input.anchorXPct),
      Math.max(0, input.anchorYPx),
      input.authorUsername,
    ],
  });
  await client.execute({
    sql: `INSERT INTO comments (id, thread_id, author_username, body)
          VALUES (?, ?, ?, ?)`,
    args: [commentId, threadId, input.authorUsername, input.body],
  });
  await replaceMentions(commentId, input.mentions);
  return { threadId, commentId };
}

export type AddReplyInput = {
  threadId: string;
  body: string;
  authorUsername: string;
  mentions: string[];
};

export async function addReply(input: AddReplyInput): Promise<string> {
  const client = await ensureDb();
  const commentId = randomUUID();
  await client.execute({
    sql: `INSERT INTO comments (id, thread_id, author_username, body)
          VALUES (?, ?, ?, ?)`,
    args: [commentId, input.threadId, input.authorUsername, input.body],
  });
  await client.execute({
    sql: `UPDATE comment_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [input.threadId],
  });
  await replaceMentions(commentId, input.mentions);
  return commentId;
}

export async function editComment(args: {
  commentId: string;
  body: string;
  mentions: string[];
}): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE comments
             SET body = ?, edited = 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
    args: [args.body, args.commentId],
  });
  await replaceMentions(args.commentId, args.mentions);
}

/** Deleting the first comment of a thread cascades the whole thread away —
 *  callers should detect that situation and call deleteThread instead so the
 *  pin disappears entirely. We don't auto-delete here because it'd hide a
 *  potential mistake (e.g. someone deleting the root by accident loses every
 *  reply too). */
export async function deleteComment(commentId: string): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM comments WHERE id = ?`,
    args: [commentId],
  });
}

export async function deleteThread(threadId: string): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM comment_threads WHERE id = ?`,
    args: [threadId],
  });
}

export async function setThreadResolved(
  threadId: string,
  resolved: boolean,
): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE comment_threads
             SET resolved = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
    args: [resolved ? 1 : 0, threadId],
  });
}

export async function getComment(commentId: string): Promise<{
  id: string;
  threadId: string;
  authorUsername: string;
  body: string;
} | null> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT id, thread_id, author_username, body FROM comments WHERE id = ?`,
    args: [commentId],
  });
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    threadId: r.thread_id as string,
    authorUsername: r.author_username as string,
    body: r.body as string,
  };
}

/** Is this the only (root) comment in its thread? Used by the API to decide
 *  whether deleting the comment should also delete the thread/pin. */
export async function isRootOnlyComment(commentId: string): Promise<boolean> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT thread_id,
                 (SELECT COUNT(*) FROM comments WHERE thread_id = c.thread_id) AS n,
                 (SELECT id FROM comments WHERE thread_id = c.thread_id
                  ORDER BY created_at ASC LIMIT 1) AS first_id
            FROM comments c WHERE id = ?`,
    args: [commentId],
  });
  if (rows.length === 0) return false;
  const r = rows[0];
  return Number(r.n) === 1 && (r.first_id as string) === commentId;
}

/** Mentionable user list for the autocomplete. Active users only; sorted by
 *  name. We don't paginate — at WB Blends scale this is comfortably under a
 *  few hundred rows. */
export async function listMentionableUsers(): Promise<MentionableUser[]> {
  const client = await ensureDb();
  const { rows } = await client.execute(
    `SELECT username, name, email, avatar_url
       FROM users
      WHERE active = 1
      ORDER BY name ASC`,
  );
  return rows.map(r => ({
    username: r.username as string,
    name: r.name as string,
    email: r.email as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
  }));
}

/** Resolve a list of @-handles to actual usernames in one query. Filters out
 *  unknown handles silently — the body keeps the @ text either way; only the
 *  email-trigger list is filtered. */
export async function resolveMentions(handles: string[]): Promise<string[]> {
  const cleaned = Array.from(new Set(handles.map(h => h.trim().toLowerCase()))).filter(Boolean);
  if (cleaned.length === 0) return [];
  const client = await ensureDb();
  const placeholders = cleaned.map(() => "?").join(", ");
  const { rows } = await client.execute({
    sql: `SELECT username FROM users
           WHERE LOWER(username) IN (${placeholders}) AND active = 1`,
    args: cleaned,
  });
  return rows.map(r => r.username as string);
}

/** Used by the email worker to look up display info for the @-mention deep
 *  link / sender label. */
export async function getUsersByUsername(usernames: string[]): Promise<MentionableUser[]> {
  if (usernames.length === 0) return [];
  const client = await ensureDb();
  const placeholders = usernames.map(() => "?").join(", ");
  const { rows } = await client.execute({
    sql: `SELECT username, name, email, avatar_url
            FROM users
           WHERE username IN (${placeholders})`,
    args: usernames,
  });
  return rows.map(r => ({
    username: r.username as string,
    name: r.name as string,
    email: r.email as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
  }));
}

// ─── Internals ─────────────────────────────────────────────────────────

async function fetchCommentsForThreads(threadIds: string[]): Promise<Map<string, Comment[]>> {
  const out = new Map<string, Comment[]>();
  if (threadIds.length === 0) return out;
  const client = await ensureDb();
  const placeholders = threadIds.map(() => "?").join(", ");
  const { rows: cRows } = await client.execute({
    sql: `SELECT c.id, c.thread_id, c.author_username, c.body, c.edited,
                 c.created_at, c.updated_at,
                 u.name AS author_name, u.email AS author_email, u.avatar_url AS author_avatar
            FROM comments c
            JOIN users u ON u.username = c.author_username
           WHERE c.thread_id IN (${placeholders})
           ORDER BY c.created_at ASC`,
    args: threadIds,
  });
  if (cRows.length === 0) return out;

  // Pull mentions for the same comment set in one query.
  const commentIds = cRows.map(r => r.id as string);
  const mentionsByComment = await fetchMentions(commentIds);

  for (const r of cRows) {
    const id = r.id as string;
    const tid = r.thread_id as string;
    const list = out.get(tid) ?? [];
    list.push({
      id,
      threadId: tid,
      author: {
        username: r.author_username as string,
        name: r.author_name as string,
        email: r.author_email as string,
        avatarUrl: (r.author_avatar as string | null) ?? null,
      },
      body: r.body as string,
      mentions: mentionsByComment.get(id) ?? [],
      edited: (r.edited as number) === 1,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    });
    out.set(tid, list);
  }
  return out;
}

async function fetchMentions(commentIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (commentIds.length === 0) return out;
  const client = await ensureDb();
  const placeholders = commentIds.map(() => "?").join(", ");
  const { rows } = await client.execute({
    sql: `SELECT comment_id, username FROM comment_mentions
           WHERE comment_id IN (${placeholders})`,
    args: commentIds,
  });
  for (const r of rows) {
    const cid = r.comment_id as string;
    const list = out.get(cid) ?? [];
    list.push(r.username as string);
    out.set(cid, list);
  }
  return out;
}

async function replaceMentions(commentId: string, usernames: string[]): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `DELETE FROM comment_mentions WHERE comment_id = ?`,
    args: [commentId],
  });
  // Dedupe; usernames here are already validated by resolveMentions.
  const set = Array.from(new Set(usernames));
  for (const u of set) {
    await client.execute({
      sql: `INSERT INTO comment_mentions (comment_id, username) VALUES (?, ?)`,
      args: [commentId, u],
    });
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
