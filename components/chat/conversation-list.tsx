"use client";

import Link from "next/link";
import { Hash, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/chat/types";
import { ChatAvatar, GroupAvatar } from "./avatar";

function formatStamp(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7)
    return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "numeric", day: "numeric" });
}

export function ConversationList({
  conversations,
  activeId,
  viewerId,
}: {
  conversations: Conversation[];
  activeId: string | null;
  viewerId: string;
}) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-sm text-muted">
        No conversations yet. Start a new chat to get going.
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {conversations.map(c => {
        const active = c.id === activeId;
        const previewSender =
          c.preview && c.preview.senderId === viewerId ? "You" : c.preview?.senderName ?? "";
        const previewBody = c.preview
          ? c.preview.hasAttachment && !c.preview.body
            ? "Sent an attachment"
            : c.preview.body
          : "No messages yet";
        return (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 border-l-2 transition-colors",
                active
                  ? "bg-primary-soft border-primary"
                  : "border-transparent hover:bg-accent",
              )}
            >
              <ConversationAvatar conversation={c} viewerId={viewerId} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      c.unread > 0 ? "text-foreground" : "text-foreground-soft",
                    )}
                  >
                    {c.displayName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-soft tabular-nums">
                    {formatStamp(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "truncate text-xs flex-1",
                      c.unread > 0 ? "text-foreground-soft font-medium" : "text-muted",
                    )}
                  >
                    {previewSender && (
                      <span className="text-muted">{previewSender}: </span>
                    )}
                    {previewBody}
                  </p>
                  {c.unread > 0 && (
                    <span className="shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-none text-white tabular-nums">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ConversationAvatar({
  conversation,
  viewerId,
}: {
  conversation: Conversation;
  viewerId: string;
}) {
  if (conversation.type === "channel") {
    return (
      <div
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-info-soft text-info"
      >
        <Hash className="h-4 w-4" />
      </div>
    );
  }
  if (conversation.type === "group") {
    if (conversation.title) {
      return (
        <div
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-foreground-soft"
        >
          <UsersIcon className="h-4 w-4" />
        </div>
      );
    }
    return (
      <GroupAvatar
        members={conversation.members.filter(m => m.id !== viewerId)}
        size={36}
      />
    );
  }
  // dm
  const other = conversation.members.find(m => m.id !== viewerId);
  return (
    <ChatAvatar
      name={other?.name ?? "?"}
      src={other?.avatarUrl}
      color={other?.avatarColor}
      size={36}
    />
  );
}
