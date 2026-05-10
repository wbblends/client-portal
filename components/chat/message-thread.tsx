"use client";

import { useEffect, useRef } from "react";
import { FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatUser, Message } from "@/lib/chat/types";
import { ChatAvatar } from "./avatar";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayHeader(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function MessageThread({
  messages,
  members,
  viewerId,
}: {
  messages: Message[];
  members: ChatUser[];
  viewerId: string;
}) {
  const memberById = new Map(members.map(m => [m.id, m]));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to bottom when new messages arrive — but only if the user was already
  // near the bottom (so they don't get yanked away while scrolling history).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // On initial mount, jump to bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  if (messages.length === 0) {
    return (
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto grid place-items-center px-6 py-10 text-sm text-muted"
      >
        No messages yet — say hello.
      </div>
    );
  }

  const decorated = messages.reduce<
    Array<{ message: Message; showDay: boolean; dayHeader: string; grouped: boolean }>
  >((acc, m) => {
    const dayHeader = formatDayHeader(m.createdAt);
    const prev = acc[acc.length - 1];
    const showDay = !prev || dayHeader !== prev.dayHeader;
    const grouped =
      !showDay &&
      !!prev &&
      prev.message.senderId === m.senderId &&
      m.createdAt - prev.message.createdAt < 5 * 60_000;
    acc.push({ message: m, showDay, dayHeader, grouped });
    return acc;
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
      <div className="flex flex-col gap-1">
        {decorated.map(({ message: m, showDay, dayHeader, grouped }) => {
          const sender = memberById.get(m.senderId);
          const isMe = m.senderId === viewerId;

          return (
            <div key={m.id} className="flex flex-col">
              {showDay && (
                <div className="my-3 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-border" />
                  <span>{dayHeader}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className={cn("flex gap-3", grouped ? "mt-0.5" : "mt-3")}>
                <div className="w-9 shrink-0">
                  {!grouped && sender && (
                    <ChatAvatar
                      name={sender.name}
                      src={sender.avatarUrl}
                      color={sender.avatarColor}
                      size={36}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {sender?.name ?? "Unknown"}
                        {isMe && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
                      </span>
                      <span className="text-[11px] text-muted-soft tabular-nums">
                        {formatTime(m.createdAt)}
                      </span>
                    </div>
                  )}
                  {m.body && (
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {m.body}
                    </p>
                  )}
                  {m.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {m.attachments.map(a => (
                        <AttachmentChip key={a.id} attachment={a} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
}: {
  attachment: { id: string; fileName: string; mimeType: string; size: number; url: string };
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  if (isImage) {
    return (
      <a
        href={`${attachment.url}?inline=1`}
        target="_blank"
        rel="noreferrer"
        className="inline-block max-w-xs rounded-lg border border-border overflow-hidden hover:border-border-strong transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${attachment.url}?inline=1`}
          alt={attachment.fileName}
          className="block max-h-64 w-auto"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 max-w-sm rounded-lg border border-border bg-surface px-3 py-2 hover:border-border-strong transition-colors"
    >
      <FileText className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{attachment.fileName}</span>
      <span className="shrink-0 text-xs text-muted">{formatBytes(attachment.size)}</span>
      <Download className="h-3.5 w-3.5 shrink-0 text-muted" />
    </a>
  );
}
