import { randomUUID } from "node:crypto";
import { db, makeDmKey } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import type {
  Attachment,
  ChatUser,
  Conversation,
  ConversationType,
  Message,
} from "@/lib/chat/types";

type UserRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "super_admin" | "internal" | "external";
  customer_id: string | null;
  company: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

function userRowToChatUser(row: UserRow): ChatUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company ?? "",
    role: row.role,
    customerId: row.customer_id,
    avatarUrl: row.avatar_url ?? undefined,
    avatarColor: row.avatar_color ?? undefined,
  };
}

export function listUsers(viewer: SessionUser): ChatUser[] {
  // Internal/super admins see everyone; externals only see other members of
  // channels they belong to (so customers can't enumerate other brands' staff).
  if (viewer.internal) {
    const rows = db()
      .prepare("SELECT * FROM users WHERE id != ? ORDER BY name")
      .all(viewer.id) as UserRow[];
    return rows.map(userRowToChatUser);
  }
  const rows = db()
    .prepare(
      `SELECT DISTINCT u.* FROM users u
       JOIN conversation_members m ON m.user_id = u.id
       WHERE m.conversation_id IN (
         SELECT conversation_id FROM conversation_members WHERE user_id = ?
       )
       AND u.id != ?
       ORDER BY u.name`,
    )
    .all(viewer.id, viewer.id) as UserRow[];
  return rows.map(userRowToChatUser);
}

export function getUser(id: string): ChatUser | null {
  const row = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  return row ? userRowToChatUser(row) : null;
}

type ConvRow = {
  id: string;
  type: ConversationType;
  title: string | null;
  customer_id: string | null;
  dm_key: string | null;
  created_by: string;
  created_at: number;
  last_message_at: number;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  file_name: string;
  mime_type: string;
  size: number;
  storage_path: string;
};

function attachmentRowToAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    size: row.size,
    url: `/api/chat/files/${row.id}`,
  };
}

function getMembers(conversationId: string): ChatUser[] {
  const rows = db()
    .prepare(
      `SELECT u.* FROM users u
       JOIN conversation_members m ON m.user_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY u.name`,
    )
    .all(conversationId) as UserRow[];
  return rows.map(userRowToChatUser);
}

function isMember(conversationId: string, userId: string): boolean {
  const row = db()
    .prepare(
      "SELECT 1 as ok FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    )
    .get(conversationId, userId) as { ok: number } | undefined;
  return !!row;
}

export function assertMember(conversationId: string, userId: string): void {
  if (!isMember(conversationId, userId)) {
    throw new HttpError(403, "Not a member of this conversation");
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function customerName(customerId: string | null): string | null {
  if (!customerId) return null;
  const row = db()
    .prepare("SELECT name FROM customers WHERE id = ?")
    .get(customerId) as { name: string } | undefined;
  return row?.name ?? null;
}

function buildDisplayName(
  conv: ConvRow,
  members: ChatUser[],
  viewer: SessionUser,
  custName: string | null,
): string {
  if (conv.type === "channel") {
    return conv.title ?? `${custName ?? "Customer"} channel`;
  }
  if (conv.type === "group") {
    if (conv.title) return conv.title;
    return members
      .filter(m => m.id !== viewer.id)
      .map(m => m.name.split(" ")[0])
      .join(", ");
  }
  // dm
  const other = members.find(m => m.id !== viewer.id);
  return other?.name ?? "Direct message";
}

function getPreview(conversationId: string): {
  senderId: string;
  senderName: string;
  body: string;
  createdAt: number;
  hasAttachment: boolean;
} | null {
  const row = db()
    .prepare(
      `SELECT msg.id, msg.sender_id, msg.body, msg.created_at, u.name as sender_name,
              EXISTS(SELECT 1 FROM attachments a WHERE a.message_id = msg.id) as has_attachment
       FROM messages msg
       JOIN users u ON u.id = msg.sender_id
       WHERE msg.conversation_id = ?
       ORDER BY msg.created_at DESC
       LIMIT 1`,
    )
    .get(conversationId) as
    | {
        id: string;
        sender_id: string;
        body: string;
        created_at: number;
        sender_name: string;
        has_attachment: number;
      }
    | undefined;
  if (!row) return null;
  return {
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    createdAt: row.created_at,
    hasAttachment: !!row.has_attachment,
  };
}

function getUnread(conversationId: string, userId: string): number {
  const lastRead = db()
    .prepare(
      "SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
    )
    .get(conversationId, userId) as { last_read_at: number } | undefined;
  if (!lastRead) return 0;
  const row = db()
    .prepare(
      `SELECT COUNT(*) as c FROM messages
       WHERE conversation_id = ? AND created_at > ? AND sender_id != ?`,
    )
    .get(conversationId, lastRead.last_read_at, userId) as { c: number };
  return row.c;
}

function rowToConversation(
  row: ConvRow,
  viewer: SessionUser,
): Conversation {
  const members = getMembers(row.id);
  const custName = customerName(row.customer_id);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    customerId: row.customer_id,
    customerName: custName,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    members,
    preview: getPreview(row.id),
    unread: getUnread(row.id, viewer.id),
    displayName: buildDisplayName(row, members, viewer, custName),
  };
}

export function listConversations(viewer: SessionUser): Conversation[] {
  const rows = db()
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_members m ON m.conversation_id = c.id
       WHERE m.user_id = ?
       ORDER BY c.last_message_at DESC`,
    )
    .all(viewer.id) as ConvRow[];
  return rows.map(r => rowToConversation(r, viewer));
}

export function getConversation(
  id: string,
  viewer: SessionUser,
): Conversation | null {
  const row = db().prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | ConvRow
    | undefined;
  if (!row) return null;
  if (!isMember(id, viewer.id)) return null;
  return rowToConversation(row, viewer);
}

export function getCustomerChannel(
  customerId: string,
  viewer: SessionUser,
): Conversation | null {
  const row = db()
    .prepare(
      "SELECT * FROM conversations WHERE type = 'channel' AND customer_id = ?",
    )
    .get(customerId) as ConvRow | undefined;
  if (!row) return null;
  if (!isMember(row.id, viewer.id)) return null;
  return rowToConversation(row, viewer);
}

export function totalUnread(viewer: SessionUser): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) as c
       FROM messages msg
       JOIN conversation_members m
         ON m.conversation_id = msg.conversation_id AND m.user_id = ?
       WHERE msg.created_at > m.last_read_at AND msg.sender_id != ?`,
    )
    .get(viewer.id, viewer.id) as { c: number };
  return row.c;
}

export function listMessages(
  conversationId: string,
  viewer: SessionUser,
  opts: { limit?: number; before?: number } = {},
): Message[] {
  assertMember(conversationId, viewer.id);
  const limit = Math.min(opts.limit ?? 100, 200);
  const before = opts.before ?? Number.MAX_SAFE_INTEGER;
  const rows = db()
    .prepare(
      `SELECT * FROM messages
       WHERE conversation_id = ? AND created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(conversationId, before, limit) as Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: number;
  }>;

  const messageIds = rows.map(r => r.id);
  const attachments = getAttachmentsForMessages(messageIds);

  return rows
    .reverse()
    .map(r => ({
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      body: r.body,
      createdAt: r.created_at,
      attachments: attachments.get(r.id) ?? [],
    }));
}

function getAttachmentsForMessages(
  messageIds: string[],
): Map<string, Attachment[]> {
  const out = new Map<string, Attachment[]>();
  if (messageIds.length === 0) return out;
  const placeholders = messageIds.map(() => "?").join(",");
  const rows = db()
    .prepare(
      `SELECT * FROM attachments WHERE message_id IN (${placeholders})`,
    )
    .all(...messageIds) as AttachmentRow[];
  for (const r of rows) {
    const list = out.get(r.message_id) ?? [];
    list.push(attachmentRowToAttachment(r));
    out.set(r.message_id, list);
  }
  return out;
}

export function getAttachment(id: string): {
  fileName: string;
  mimeType: string;
  storagePath: string;
  size: number;
  conversationId: string;
} | null {
  const row = db()
    .prepare(
      `SELECT a.*, m.conversation_id FROM attachments a
       JOIN messages m ON m.id = a.message_id
       WHERE a.id = ?`,
    )
    .get(id) as
    | (AttachmentRow & { conversation_id: string })
    | undefined;
  if (!row) return null;
  return {
    fileName: row.file_name,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    size: row.size,
    conversationId: row.conversation_id,
  };
}

export function sendMessage(
  conversationId: string,
  viewer: SessionUser,
  body: string,
  attachments: Array<{
    fileName: string;
    mimeType: string;
    size: number;
    storagePath: string;
  }> = [],
): Message {
  assertMember(conversationId, viewer.id);
  const trimmed = body.trim();
  if (!trimmed && attachments.length === 0) {
    throw new HttpError(400, "Message body or attachment is required");
  }
  const now = Date.now();
  const messageId = `M-${randomUUID()}`;

  const insertMsg = db().prepare(
    "INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const insertAttach = db().prepare(
    `INSERT INTO attachments (id, message_id, file_name, mime_type, size, storage_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const bumpConv = db().prepare(
    "UPDATE conversations SET last_message_at = ? WHERE id = ?",
  );
  const markSenderRead = db().prepare(
    "UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
  );

  const out: Attachment[] = [];
  db().transaction(() => {
    insertMsg.run(messageId, conversationId, viewer.id, trimmed, now);
    for (const a of attachments) {
      const aid = `A-${randomUUID()}`;
      insertAttach.run(aid, messageId, a.fileName, a.mimeType, a.size, a.storagePath, now);
      out.push({
        id: aid,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
        url: `/api/chat/files/${aid}`,
      });
    }
    bumpConv.run(now, conversationId);
    markSenderRead.run(now, conversationId, viewer.id);
  })();

  return {
    id: messageId,
    conversationId,
    senderId: viewer.id,
    body: trimmed,
    createdAt: now,
    attachments: out,
  };
}

export function markRead(
  conversationId: string,
  viewer: SessionUser,
  upTo: number = Date.now(),
): number {
  assertMember(conversationId, viewer.id);
  db()
    .prepare(
      `UPDATE conversation_members SET last_read_at = ?
       WHERE conversation_id = ? AND user_id = ? AND last_read_at < ?`,
    )
    .run(upTo, conversationId, viewer.id, upTo);
  return upTo;
}

export function findOrCreateDM(
  viewer: SessionUser,
  otherUserId: string,
): Conversation {
  if (otherUserId === viewer.id) {
    throw new HttpError(400, "Cannot DM yourself");
  }
  const other = getUser(otherUserId);
  if (!other) throw new HttpError(404, "User not found");

  const dmKey = makeDmKey(viewer.id, otherUserId);
  const existing = db()
    .prepare("SELECT id FROM conversations WHERE dm_key = ?")
    .get(dmKey) as { id: string } | undefined;
  if (existing) {
    const c = getConversation(existing.id, viewer);
    if (c) return c;
  }

  const now = Date.now();
  const id = `DM-${randomUUID()}`;
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO conversations (id, type, title, customer_id, dm_key, created_by, created_at, last_message_at)
         VALUES (?, 'dm', NULL, NULL, ?, ?, ?, ?)`,
      )
      .run(id, dmKey, viewer.id, now, now);
    const insertMember = db().prepare(
      "INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)",
    );
    insertMember.run(id, viewer.id, now, now);
    insertMember.run(id, otherUserId, now, 0);
  })();
  return getConversation(id, viewer)!;
}

export function createGroup(
  viewer: SessionUser,
  memberIds: string[],
  title?: string,
): Conversation {
  const set = new Set(memberIds);
  set.add(viewer.id);
  if (set.size < 3) {
    throw new HttpError(400, "Group chats need at least 3 participants");
  }
  const now = Date.now();
  const id = `G-${randomUUID()}`;
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO conversations (id, type, title, customer_id, dm_key, created_by, created_at, last_message_at)
         VALUES (?, 'group', ?, NULL, NULL, ?, ?, ?)`,
      )
      .run(id, title ?? null, viewer.id, now, now);
    const insertMember = db().prepare(
      "INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)",
    );
    for (const uid of set) {
      insertMember.run(id, uid, now, uid === viewer.id ? now : 0);
    }
  })();
  return getConversation(id, viewer)!;
}

/**
 * Replace the entire member list for a channel. Only super_admin can do this.
 * Returns the refreshed conversation.
 */
export function setChannelMembers(
  viewer: SessionUser,
  conversationId: string,
  memberIds: string[],
): Conversation {
  if (viewer.role !== "super_admin") {
    throw new HttpError(403, "Only super admins can manage channel membership");
  }
  const conv = db()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(conversationId) as ConvRow | undefined;
  if (!conv) throw new HttpError(404, "Conversation not found");
  if (conv.type !== "channel") {
    throw new HttpError(400, "Membership editor only available for channels");
  }
  const set = new Set(memberIds);
  set.add(viewer.id); // super admin keeps themselves in the room

  const now = Date.now();
  db().transaction(() => {
    db()
      .prepare("DELETE FROM conversation_members WHERE conversation_id = ?")
      .run(conversationId);
    const insertMember = db().prepare(
      "INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_at) VALUES (?, ?, ?, ?)",
    );
    for (const uid of set) {
      insertMember.run(conversationId, uid, now, 0);
    }
  })();

  // Re-fetch as super_admin always (they have access).
  return getConversation(conversationId, viewer)!;
}

export function searchMessages(
  viewer: SessionUser,
  query: string,
  limit = 30,
): Array<{
  conversationId: string;
  conversationName: string;
  message: Message;
  senderName: string;
}> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = db()
    .prepare(
      `SELECT msg.id, msg.conversation_id, msg.sender_id, msg.body, msg.created_at,
              u.name AS sender_name
       FROM messages msg
       JOIN conversation_members mem
         ON mem.conversation_id = msg.conversation_id AND mem.user_id = ?
       JOIN users u ON u.id = msg.sender_id
       WHERE msg.body LIKE ?
       ORDER BY msg.created_at DESC
       LIMIT ?`,
    )
    .all(viewer.id, `%${q}%`, limit) as Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: number;
    sender_name: string;
  }>;

  const ids = rows.map(r => r.id);
  const attachments = getAttachmentsForMessages(ids);
  const convIds = Array.from(new Set(rows.map(r => r.conversation_id)));
  const convNameById = new Map<string, string>();
  for (const cid of convIds) {
    const c = getConversation(cid, viewer);
    if (c) convNameById.set(cid, c.displayName);
  }

  return rows.map(r => ({
    conversationId: r.conversation_id,
    conversationName: convNameById.get(r.conversation_id) ?? "Conversation",
    senderName: r.sender_name,
    message: {
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      body: r.body,
      createdAt: r.created_at,
      attachments: attachments.get(r.id) ?? [],
    },
  }));
}
