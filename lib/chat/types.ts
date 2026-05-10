import type { Role } from "@/lib/auth";

export type ConversationType = "dm" | "group" | "channel";

export type ChatUser = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: Role;
  customerId: string | null;
  avatarUrl?: string;
  avatarColor?: string;
};

export type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string; // /api/chat/files/<id>
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: number;
  attachments: Attachment[];
};

export type Conversation = {
  id: string;
  type: ConversationType;
  title: string | null;
  customerId: string | null;
  customerName: string | null;
  createdBy: string;
  createdAt: number;
  lastMessageAt: number;
  members: ChatUser[];
  /** Most-recent message preview, if any. */
  preview: {
    senderId: string;
    senderName: string;
    body: string;
    createdAt: number;
    hasAttachment: boolean;
  } | null;
  /** Count of messages newer than the current viewer's last_read_at. */
  unread: number;
  /** Display label for the current viewer (other-party name for DMs, etc.). */
  displayName: string;
};

export type ChatEvent =
  | { kind: "message"; conversationId: string; message: Message }
  | { kind: "read"; conversationId: string; userId: string; lastReadAt: number }
  | { kind: "members"; conversationId: string; members: ChatUser[] }
  | { kind: "conversation"; conversation: Conversation };
