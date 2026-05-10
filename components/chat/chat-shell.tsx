"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Hash,
  MessageSquare,
  Plus,
  Settings,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatEvent, Conversation, Message } from "@/lib/chat/types";
import type { Role } from "@/lib/auth";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { MessageComposer } from "./message-composer";
import { NewChatDialog } from "./new-chat-dialog";
import { ManageMembersDialog } from "./manage-members-dialog";
import { ChatSearch } from "./chat-search";
import { useChatRealtime } from "./realtime-provider";

export function ChatShell({
  viewerId,
  viewerRole,
  activeId,
}: {
  viewerId: string;
  viewerRole: Role;
  activeId: string | null;
}) {
  const router = useRouter();
  const { conversations, ready, subscribe, refresh } = useChatRealtime();
  const [showNew, setShowNew] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [fetchedConv, setFetchedConv] = useState<Conversation | null>(null);
  const [showListOnMobile, setShowListOnMobile] = useState(activeId == null);

  const lastMarkedReadAt = useRef(0);

  // Active conversation comes from the realtime list when possible, falling
  // back to a direct fetch (e.g., super_admin landed via deep link).
  const fromList = activeId
    ? conversations.find(c => c.id === activeId) ?? null
    : null;
  const activeConv: Conversation | null =
    fromList ?? (fetchedConv?.id === activeId ? fetchedConv : null);

  useEffect(() => {
    if (!activeId || !ready) return;
    if (conversations.some(c => c.id === activeId)) return;
    let cancelled = false;
    fetch(`/api/chat/conversations/${activeId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data?.conversation) setFetchedConv(data.conversation);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, conversations, ready]);

  // Load messages for the active conversation.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag must flip on conversation change
    setLoadingMessages(true);
    fetch(`/api/chat/conversations/${activeId}/messages`)
      .then(r => (r.ok ? r.json() : { messages: [] }))
      .then(data => {
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Subscribe to live message events for the active conversation.
  useEffect(() => {
    if (!activeId) return;
    return subscribe((event: ChatEvent) => {
      if (event.kind === "message" && event.conversationId === activeId) {
        setMessages(prev => {
          if (prev.some(m => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      } else if (event.kind === "members" && event.conversationId === activeId) {
        // Keep the deep-linked fallback in sync; the realtime list updates
        // itself via the provider.
        setFetchedConv(prev =>
          prev && prev.id === activeId ? { ...prev, members: event.members } : prev,
        );
      }
    });
  }, [activeId, subscribe]);

  // Mark messages read when viewing a conversation with unread messages.
  useEffect(() => {
    if (!activeId || !activeConv) return;
    if (activeConv.unread === 0 && lastMarkedReadAt.current >= activeConv.lastMessageAt) return;
    if (lastMarkedReadAt.current >= activeConv.lastMessageAt) return;
    const upTo = Date.now();
    lastMarkedReadAt.current = upTo;
    fetch(`/api/chat/conversations/${activeId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upTo }),
    }).then(() => {
      refresh();
    });
  }, [activeId, activeConv, refresh]);

  const isChannel = activeConv?.type === "channel";
  const canManage = viewerRole === "super_admin" && isChannel;

  return (
    <div className="h-[calc(100dvh-7rem)] lg:h-dvh flex">
      {/* Left: conversation list */}
      <aside
        className={cn(
          "w-full lg:w-80 border-r border-border bg-card flex flex-col",
          activeId && !showListOnMobile ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Chat
            </h1>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          </div>
          <ChatSearch onNavigated={() => setShowListOnMobile(false)} />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {!ready ? (
            <div className="px-4 py-6 text-sm text-muted">Loading…</div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              viewerId={viewerId}
            />
          )}
        </div>
      </aside>

      {/* Right: thread */}
      <section
        className={cn(
          "flex-1 flex-col bg-surface min-w-0",
          activeId && !showListOnMobile ? "flex" : "hidden lg:flex",
        )}
      >
        {!activeConv ? (
          <EmptyState onNew={() => setShowNew(true)} />
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border bg-card px-4 sm:px-6 py-3">
              <button
                type="button"
                className="lg:hidden text-sm text-muted hover:text-foreground"
                onClick={() => {
                  setShowListOnMobile(true);
                  router.push("/chat");
                }}
                aria-label="Back to conversations"
              >
                ←
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {isChannel && <Hash className="h-4 w-4 text-info shrink-0" />}
                  <h2 className="truncate text-base font-semibold text-foreground">
                    {activeConv.displayName}
                  </h2>
                </div>
                <p className="truncate text-xs text-muted">
                  {activeConv.members.length} member
                  {activeConv.members.length === 1 ? "" : "s"}
                  {activeConv.customerName && ` · ${activeConv.customerName}`}
                </p>
              </div>
              {canManage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMembers(true)}
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Members</span>
                </Button>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted">
                  <UsersIcon className="h-3.5 w-3.5" />
                  {activeConv.members.length}
                </span>
              )}
            </header>
            {loadingMessages && messages.length === 0 ? (
              <div className="flex-1 grid place-items-center text-sm text-muted">
                Loading messages…
              </div>
            ) : (
              <MessageThread
                messages={messages}
                members={activeConv.members}
                viewerId={viewerId}
              />
            )}
            <MessageComposer
              conversationId={activeConv.id}
              placeholder={`Message ${activeConv.displayName}`}
            />
          </>
        )}
      </section>

      {showNew && (
        <NewChatDialog onClose={() => setShowNew(false)} viewerId={viewerId} />
      )}
      {showMembers && activeConv && canManage && (
        <ManageMembersDialog
          onClose={() => setShowMembers(false)}
          conversation={activeConv}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-primary-soft text-primary">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl text-foreground">
          Pick up where you left off
        </h2>
        <p className="mt-2 text-sm text-muted">
          Choose a conversation on the left, or start a new chat with anyone in
          your channels.
        </p>
        <Button className="mt-4" onClick={onNew}>
          <Plus className="h-4 w-4" />
          Start a new chat
        </Button>
      </div>
    </div>
  );
}
