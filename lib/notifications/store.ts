/**
 * Notifications store — in-app inbox for the bell dropdown in the user menu.
 *
 * Today the only producer is @mentions in comments; recordMentionNotifications
 * is called from the comment/reply/edit API routes alongside the existing
 * fire-and-forget email notifier. The DB write is awaited (cheap, local) so
 * the bell stays consistent with what actually shipped.
 *
 * Reads are scoped to the current user — there is no admin "all notifications"
 * view yet. The recipient index makes both the unread-count check and the
 * dropdown list query a prefix scan.
 */
import { randomUUID } from "node:crypto";
import { ensureDb } from "@/lib/db";
import { commentExcerpt } from "@/lib/comments/mentions";

export type NotificationItem = {
  id: string;
  type: "mention";
  /** Username of the person who triggered the notification (e.g. comment author). */
  actorUsername: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  /** Stable link target — opens the page with the comment thread overlay focused. */
  href: string;
  /** Single-line excerpt of the comment body. */
  excerpt: string;
  /** Display route ("/orders", "/c/acme/docs"). */
  route: string;
  threadId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type RecordMentionInput = {
  /** Usernames to notify. The caller should already have stripped the actor
   *  themselves (matches notifyMentions' email behavior). */
  recipientUsernames: string[];
  actorUsername: string;
  commentId: string;
  threadId: string;
  route: string;
  body: string;
};

/** Insert one notification row per recipient. No-op when there are no
 *  recipients — keeps callers from having to guard. */
export async function recordMentionNotifications(
  input: RecordMentionInput,
): Promise<void> {
  // Filter out the actor in case the caller forgot — saving someone a
  // notification when they @ themselves matches the email-side behavior.
  const recipients = input.recipientUsernames.filter(u => u !== input.actorUsername);
  if (recipients.length === 0) return;

  const client = await ensureDb();
  const excerpt = commentExcerpt(input.body);
  for (const recipient of recipients) {
    await client.execute({
      sql: `INSERT INTO notifications
              (id, recipient_username, type, actor_username, comment_id,
               thread_id, route, excerpt)
            VALUES (?, ?, 'mention', ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(),
        recipient,
        input.actorUsername,
        input.commentId,
        input.threadId,
        input.route,
        excerpt,
      ],
    });
  }
}

/** Most-recent notifications for the dropdown. Unread first is implicit —
 *  the read_at IS NULL clause in the index sort path keeps the order stable
 *  even when older items are marked read. */
export async function listNotificationsForUser(
  username: string,
  limit = 20,
): Promise<NotificationItem[]> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT n.id, n.type, n.actor_username, n.comment_id, n.thread_id,
                 n.route, n.excerpt, n.read_at, n.created_at,
                 u.name        AS actor_name,
                 u.avatar_url  AS actor_avatar
            FROM notifications n
       LEFT JOIN users u ON u.username = n.actor_username
           WHERE n.recipient_username = ?
           ORDER BY n.read_at IS NULL DESC, n.created_at DESC
           LIMIT ?`,
    args: [username, limit],
  });
  return rows.map(r => {
    const route = (r.route as string) ?? "/";
    const threadId = (r.thread_id as string | null) ?? null;
    return {
      id: r.id as string,
      type: r.type as "mention",
      actorUsername: (r.actor_username as string | null) ?? null,
      actorName: (r.actor_name as string | null) ?? null,
      actorAvatarUrl: (r.actor_avatar as string | null) ?? null,
      href: buildHref(route, threadId),
      excerpt: (r.excerpt as string) ?? "",
      route,
      threadId,
      commentId: (r.comment_id as string | null) ?? null,
      readAt: (r.read_at as string | null) ?? null,
      createdAt: r.created_at as string,
    };
  });
}

export async function unreadCountForUser(username: string): Promise<number> {
  const client = await ensureDb();
  const { rows } = await client.execute({
    sql: `SELECT COUNT(*) AS n FROM notifications
           WHERE recipient_username = ? AND read_at IS NULL`,
    args: [username],
  });
  return Number(rows[0]?.n ?? 0);
}

/** Mark a specific set of notification ids as read for this user. Filters by
 *  recipient_username so a forged id from another user is a no-op. */
export async function markNotificationsRead(
  username: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const client = await ensureDb();
  const placeholders = ids.map(() => "?").join(", ");
  await client.execute({
    sql: `UPDATE notifications
             SET read_at = CURRENT_TIMESTAMP
           WHERE recipient_username = ?
             AND read_at IS NULL
             AND id IN (${placeholders})`,
    args: [username, ...ids],
  });
}

export async function markAllNotificationsRead(username: string): Promise<void> {
  const client = await ensureDb();
  await client.execute({
    sql: `UPDATE notifications
             SET read_at = CURRENT_TIMESTAMP
           WHERE recipient_username = ? AND read_at IS NULL`,
    args: [username],
  });
}

function buildHref(route: string, threadId: string | null): string {
  if (!threadId) return route || "/";
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}wbb_comment=${encodeURIComponent(threadId)}`;
}
