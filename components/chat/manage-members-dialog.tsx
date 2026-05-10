"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatUser, Conversation } from "@/lib/chat/types";
import { ChatAvatar } from "./avatar";
import { useChatRealtime } from "./realtime-provider";

/** Super-admin tool for editing the membership of a per-customer channel. */
export function ManageMembersDialog({
  onClose,
  conversation,
}: {
  onClose: () => void;
  conversation: Conversation;
}) {
  const { upsertConversation } = useChatRealtime();
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(conversation.members.map(m => m.id)),
  );
  const [filter, setFilter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chat/directory?scope=all")
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setAllUsers(d.users ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const internal = useMemo(
    () => allUsers.filter(u => u.role !== "external"),
    [allUsers],
  );
  const external = useMemo(
    () =>
      allUsers.filter(
        u => u.role === "external" && u.customerId === conversation.customerId,
      ),
    [allUsers, conversation.customerId],
  );
  const otherExternal = useMemo(
    () =>
      allUsers.filter(
        u => u.role === "external" && u.customerId !== conversation.customerId,
      ),
    [allUsers, conversation.customerId],
  );

  const q = filter.trim().toLowerCase();
  function applyFilter(list: ChatUser[]): ChatUser[] {
    if (!q) return list;
    return list.filter(
      u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.company.toLowerCase().includes(q),
    );
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversation.id}/members`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds: Array.from(selected) }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as { conversation: Conversation };
      upsertConversation(data.conversation);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save members");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage channel members"
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-card shadow-[var(--shadow-popover)] flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold">Manage members</h2>
            <p className="text-xs text-muted">
              {conversation.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-soft" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search…"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-soft focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <Section
            label="WB Blends contacts"
            users={applyFilter(internal)}
            selected={selected}
            onToggle={toggle}
          />
          <Section
            label={`${conversation.customerName ?? "Customer"} contacts`}
            users={applyFilter(external)}
            selected={selected}
            onToggle={toggle}
          />
          {otherExternal.length > 0 && (
            <Section
              label="Other customers"
              users={applyFilter(otherExternal)}
              selected={selected}
              onToggle={toggle}
            />
          )}
        </div>

        {error && (
          <div className="px-5 pb-2 text-xs text-danger">{error}</div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-xs text-muted">
            {selected.size} member{selected.size === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  users,
  selected,
  onToggle,
}: {
  label: string;
  users: ChatUser[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (users.length === 0) return null;
  return (
    <div className="pt-2">
      <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <ul>
        {users.map(u => {
          const isSelected = selected.has(u.id);
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onToggle(u.id)}
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
    </div>
  );
}
