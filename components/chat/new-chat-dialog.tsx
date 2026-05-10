"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatUser, Conversation } from "@/lib/chat/types";
import { ChatAvatar } from "./avatar";
import { useChatRealtime } from "./realtime-provider";

export function NewChatDialog({
  onClose,
  viewerId,
}: {
  onClose: () => void;
  viewerId: string;
}) {
  const router = useRouter();
  const { upsertConversation } = useChatRealtime();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/directory")
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setUsers(d.users ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.company.toLowerCase().includes(q),
    );
  }, [filter, users]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const memberIds = Array.from(selected);
      const isDM = memberIds.length === 1;
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isDM ? "dm" : "group",
          memberIds,
          title: !isDM && title.trim() ? title.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { conversation: Conversation };
      upsertConversation(data.conversation);
      onClose();
      router.push(`/chat/${data.conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start chat");
    } finally {
      setSubmitting(false);
    }
  }

  const isGroup = selected.size >= 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start a new chat"
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-card shadow-[var(--shadow-popover)] flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold">Start a new chat</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-soft" />
            <input
              autoFocus
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search people…"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-soft focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
          {isGroup && (
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Group name (optional)"
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm placeholder:text-muted-soft focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted">No matches.</div>
          ) : (
            <ul>
              {filtered.map(u => {
                const isSelected = selected.has(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        isSelected ? "bg-primary-soft" : "hover:bg-accent",
                      )}
                    >
                      <ChatAvatar
                        name={u.name}
                        src={u.avatarUrl}
                        color={u.avatarColor}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {u.name}
                          {u.id === viewerId && (
                            <span className="ml-1 text-xs text-muted">(you)</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {u.company} · {u.email}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <div className="px-5 pb-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-xs text-muted">
            {selected.size === 0
              ? "Select one person for a DM, or two+ for a group."
              : selected.size === 1
              ? "Direct message"
              : `Group chat — ${selected.size} people`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={selected.size === 0 || submitting}
            >
              {submitting ? "Starting…" : "Start chat"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
