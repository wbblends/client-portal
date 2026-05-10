"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatEvent, Conversation } from "@/lib/chat/types";

type Ctx = {
  conversations: Conversation[];
  totalUnread: number;
  /** Replace a single conversation in the list (used after API mutations). */
  upsertConversation: (c: Conversation) => void;
  /** Refetch the conversation list from /api. */
  refresh: () => Promise<void>;
  /** Subscribe to raw SSE events. Returns an unsubscribe fn. */
  subscribe: (handler: (e: ChatEvent) => void) => () => void;
  ready: boolean;
};

const ChatRealtimeContext = createContext<Ctx | null>(null);

export function useChatRealtime(): Ctx {
  const v = useContext(ChatRealtimeContext);
  if (!v) throw new Error("useChatRealtime used outside provider");
  return v;
}

export function ChatRealtimeProvider({
  viewerId,
  children,
}: {
  viewerId: string;
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [ready, setReady] = useState(false);
  const handlersRef = useRef(new Set<(e: ChatEvent) => void>());

  const recompute = useCallback((list: Conversation[]) => {
    let total = 0;
    for (const c of list) total += c.unread;
    setTotalUnread(total);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/chat/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversations: Conversation[];
      totalUnread: number;
    };
    setConversations(data.conversations);
    setTotalUnread(data.totalUnread);
    setReady(true);
  }, []);

  const upsertConversation = useCallback(
    (c: Conversation) => {
      setConversations(prev => {
        const idx = prev.findIndex(x => x.id === c.id);
        let next: Conversation[];
        if (idx === -1) next = [c, ...prev];
        else {
          next = prev.slice();
          next[idx] = c;
        }
        next.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        recompute(next);
        return next;
      });
    },
    [recompute],
  );

  const subscribe = useCallback((handler: (e: ChatEvent) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    // Initial fetch + open the SSE connection together so the list is populated
    // by the time the first realtime event arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time data load
    refresh();
    const es = new EventSource("/api/chat/stream");
    es.addEventListener("chat", ev => {
      let event: ChatEvent;
      try {
        event = JSON.parse((ev as MessageEvent).data) as ChatEvent;
      } catch {
        return;
      }
      // Handle in the provider first so any list-state updates apply before
      // downstream subscribers render.
      handleEvent(event);
      for (const h of handlersRef.current) {
        try {
          h(event);
        } catch {
          /* ignore */
        }
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here besides log in dev.
    };
    return () => es.close();

    function handleEvent(event: ChatEvent) {
      if (event.kind === "message") {
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === event.conversationId);
          if (idx === -1) {
            // Conversation not in the local list yet — refetch to pick it up.
            refresh();
            return prev;
          }
          const next = prev.slice();
          const conv = { ...next[idx] };
          conv.lastMessageAt = event.message.createdAt;
          conv.preview = {
            senderId: event.message.senderId,
            senderName:
              conv.members.find(m => m.id === event.message.senderId)?.name ?? "",
            body: event.message.body,
            createdAt: event.message.createdAt,
            hasAttachment: event.message.attachments.length > 0,
          };
          if (event.message.senderId !== viewerId) conv.unread += 1;
          next[idx] = conv;
          next.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
          recompute(next);
          return next;
        });
      } else if (event.kind === "read" && event.userId === viewerId) {
        setConversations(prev => {
          const next = prev.map(c =>
            c.id === event.conversationId ? { ...c, unread: 0 } : c,
          );
          recompute(next);
          return next;
        });
      } else if (event.kind === "members") {
        setConversations(prev => {
          const next = prev.map(c =>
            c.id === event.conversationId ? { ...c, members: event.members } : c,
          );
          return next;
        });
      } else if (event.kind === "conversation") {
        upsertConversation(event.conversation);
      }
    }
  }, [refresh, recompute, upsertConversation, viewerId]);

  return (
    <ChatRealtimeContext.Provider
      value={{
        conversations,
        totalUnread,
        upsertConversation,
        refresh,
        subscribe,
        ready,
      }}
    >
      {children}
    </ChatRealtimeContext.Provider>
  );
}
