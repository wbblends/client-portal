"use client";

/**
 * Figma-style page comments overlay.
 *
 * Mounted once at the top of the portal layout. Owns:
 *  - the global `c` hotkey to toggle comment mode
 *  - per-route fetch + render of pin threads
 *  - click-to-place pin creation, popover threads, replies, edits, mentions
 *
 * Anchoring strategy: each pin is stored as (anchor_x_pct, anchor_y_px)
 * relative to the page's <main> element. x is a fraction of main's width
 * (responsive), y is a pixel offset from main's top (immune to content reflow
 * above the pin). On render we measure <main>'s page-relative position and
 * size, then position each pin absolutely inside a body-mounted overlay.
 *
 * Mention emails go out from the API on submit when an @-handle resolves to
 * an active user. The overlay shows the autocomplete and parses the body for
 * the highlighted display.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  MessageSquarePlus,
  MessageSquare,
  Check,
  X,
  Trash2,
  Pencil,
  CornerDownLeft,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types (mirrors lib/comments/store.ts shape over the wire) ────────────

type CommentAuthor = {
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type Comment = {
  id: string;
  threadId: string;
  author: CommentAuthor;
  body: string;
  mentions: string[];
  edited: boolean;
  createdAt: string;
  updatedAt: string;
};

type Thread = {
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

type MentionableUser = {
  username: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type CurrentUser = {
  username: string;
  name: string;
  avatarUrl: string | null;
};

// ─── Top-level overlay ────────────────────────────────────────────────────

export function CommentLayer({ currentUser }: { currentUser: CurrentUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"off" | "on">("off");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [mentionable, setMentionable] = useState<MentionableUser[]>([]);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [pending, setPending] = useState<{ xPct: number; yPx: number } | null>(null);
  const [mainRect, setMainRect] = useState<MainRect | null>(null);

  // Re-fetch when the route changes.
  const route = pathname;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/comments?route=${encodeURIComponent(route)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { threads: Thread[] };
      setThreads(data.threads);
    } catch {
      // Network blip — leave stale data, the next refresh will recover.
    }
  }, [route]);

  useEffect(() => {
    void refresh();
    setOpenThreadId(null);
    setPending(null);
  }, [refresh]);

  // Lazy-load the mentionable list the first time the user enters comment
  // mode — keeps initial portal load free of the extra round trip.
  useEffect(() => {
    if (mode === "off" || mentionable.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/comments/mentionable", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { users: MentionableUser[] };
        if (!cancelled) setMentionable(data.users);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, mentionable.length]);

  // Track <main>'s page position + size so we can place pins. Updates on
  // resize, scroll, and any layout change inside <main>.
  useLayoutEffect(() => {
    const el = document.querySelector("main");
    if (!el) return;
    function measure() {
      const rect = el!.getBoundingClientRect();
      setMainRect({
        pageLeft: rect.left + window.scrollX,
        pageTop: rect.top + window.scrollY,
        width: rect.width,
        height: el!.scrollHeight,
      });
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [pathname]);

  // Hotkey: `c` toggles comment mode (when not typing into something).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pending) {
          setPending(null);
          return;
        }
        if (openThreadId) {
          setOpenThreadId(null);
          return;
        }
        if (mode === "on") {
          setMode("off");
        }
        return;
      }
      if (e.key.toLowerCase() !== "c") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setMode(m => (m === "on" ? "off" : "on"));
      setPending(null);
      setOpenThreadId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, openThreadId, pending]);

  // Deep-link: `?wbb_comment=<threadId>` opens a thread on load. Strip the
  // param after handling so reloading doesn't re-open it forever.
  useEffect(() => {
    const target = searchParams.get("wbb_comment");
    if (!target) return;
    const t = threads.find(x => x.id === target);
    if (!t) return;
    setMode("on");
    setShowResolved(true);
    setOpenThreadId(target);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("wbb_comment");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, threads, pathname, router]);

  // Catcher click → drop a pending pin. Only fires when comment mode is on
  // and we're not already mid-thread (popover open or pending pin exists).
  function onCatcherClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!mainRect) return;
    if (openThreadId || pending) return;
    const xPct = (e.clientX + window.scrollX - mainRect.pageLeft) / mainRect.width;
    const yPx = e.clientY + window.scrollY - mainRect.pageTop;
    setPending({ xPct: clamp01(xPct), yPx: Math.max(0, yPx) });
  }

  const visibleThreads = useMemo(
    () => (showResolved ? threads : threads.filter(t => !t.resolved)),
    [threads, showResolved],
  );

  const showCatcher = mode === "on" && !openThreadId && !pending;

  return (
    <>
      <Toolbar
        mode={mode}
        onToggleMode={() => setMode(m => (m === "on" ? "off" : "on"))}
        showResolved={showResolved}
        onToggleResolved={() => setShowResolved(s => !s)}
        threadCount={threads.length}
        unresolvedCount={threads.filter(t => !t.resolved).length}
      />

      {/* Catcher overlay — only when in comment mode and no thread/pending
          pin is open. Sits over <main> and intercepts clicks for placement. */}
      {showCatcher && mainRect && (
        <div
          onClick={onCatcherClick}
          className="absolute z-[60] cursor-crosshair"
          style={{
            top: mainRect.pageTop,
            left: mainRect.pageLeft,
            width: mainRect.width,
            height: mainRect.height,
          }}
          aria-label="Click to place a comment"
        />
      )}

      {/* Pins + open popovers — always visible when comment mode is on. */}
      {mode === "on" && mainRect && (
        <div
          className="pointer-events-none absolute z-[70]"
          style={{
            top: mainRect.pageTop,
            left: mainRect.pageLeft,
            width: mainRect.width,
            height: mainRect.height,
          }}
        >
          {visibleThreads.map(t => (
            <Pin
              key={t.id}
              thread={t}
              open={openThreadId === t.id}
              onOpen={() => setOpenThreadId(t.id)}
            />
          ))}

          {pending && (
            <PendingPin
              xPct={pending.xPct}
              yPx={pending.yPx}
              currentUser={currentUser}
              mentionable={mentionable}
              onCancel={() => setPending(null)}
              onCreated={async () => {
                setPending(null);
                await refresh();
              }}
              route={route}
            />
          )}
        </div>
      )}

      {/* Open thread popover — rendered separately so it can reach into a
          higher z-index without being clipped by the pins layer. */}
      {mode === "on" &&
        mainRect &&
        openThreadId &&
        (() => {
          const t = threads.find(x => x.id === openThreadId);
          if (!t) return null;
          return (
            <ThreadPopover
              thread={t}
              currentUser={currentUser}
              mentionable={mentionable}
              mainRect={mainRect}
              onClose={() => setOpenThreadId(null)}
              onMutated={refresh}
            />
          );
        })()}
    </>
  );
}

// ─── Toolbar (bottom-right floating control) ──────────────────────────────

function Toolbar({
  mode,
  onToggleMode,
  showResolved,
  onToggleResolved,
  threadCount,
  unresolvedCount,
}: {
  mode: "off" | "on";
  onToggleMode: () => void;
  showResolved: boolean;
  onToggleResolved: () => void;
  threadCount: number;
  unresolvedCount: number;
}) {
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-[80] flex items-center gap-2 lg:bottom-4">
      {mode === "on" && threadCount > 0 && (
        <button
          type="button"
          onClick={onToggleResolved}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium shadow-[var(--shadow-popover)] transition-colors",
            showResolved
              ? "text-foreground hover:bg-accent"
              : "text-muted hover:text-foreground hover:bg-accent",
          )}
          title={showResolved ? "Hide resolved" : "Show resolved"}
        >
          {showResolved ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showResolved ? "Showing resolved" : "Hiding resolved"}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMode}
        className={cn(
          "group relative inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[13px] font-medium shadow-[var(--shadow-popover)] transition-colors",
          mode === "on"
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
            : "border-border bg-card text-foreground hover:bg-accent",
        )}
        title={mode === "on" ? "Exit comment mode (C)" : "Comment mode (C)"}
        aria-pressed={mode === "on"}
      >
        {mode === "on" ? (
          <MessageSquare className="h-4 w-4" />
        ) : (
          <MessageSquarePlus className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {mode === "on" ? "Exit" : "Comment"}
        </span>
        <kbd
          className={cn(
            "ml-1 hidden sm:inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
            mode === "on"
              ? "border-primary-foreground/40 bg-primary-hover text-primary-foreground"
              : "border-border bg-surface text-muted",
          )}
        >
          C
        </kbd>
        {mode === "off" && unresolvedCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unresolvedCount}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── A single pin ─────────────────────────────────────────────────────────

function Pin({
  thread,
  open,
  onOpen,
}: {
  thread: Thread;
  open: boolean;
  onOpen: () => void;
}) {
  const root = thread.comments[0];
  const replyCount = Math.max(0, thread.comments.length - 1);
  const author = root?.author;

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "pointer-events-auto absolute -translate-x-1 -translate-y-full",
        "transition-transform hover:scale-105 focus:outline-none",
      )}
      style={{
        left: `${thread.anchorXPct * 100}%`,
        top: thread.anchorYPx,
      }}
      aria-label={`Open comment thread by ${author?.name ?? "user"}`}
    >
      <div
        className={cn(
          "flex h-9 items-center gap-1 rounded-full rounded-bl-sm border-2 border-card pl-0.5 pr-2 shadow-[var(--shadow-popover)]",
          thread.resolved
            ? "bg-success text-white opacity-70"
            : open
              ? "bg-primary text-primary-foreground"
              : "bg-primary text-primary-foreground",
        )}
      >
        <PinAvatar author={author} />
        {replyCount > 0 && (
          <span className="text-[11px] font-semibold leading-none tabular-nums">
            {replyCount + 1}
          </span>
        )}
        {thread.resolved && <Check className="h-3 w-3" />}
      </div>
    </button>
  );
}

function PinAvatar({ author }: { author?: CommentAuthor }) {
  if (!author) return <div className="h-7 w-7 rounded-full bg-card/30" />;
  if (author.avatarUrl) {
    return (
      <Image
        src={author.avatarUrl}
        alt={author.name}
        width={28}
        height={28}
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full bg-card text-[10px] font-semibold text-primary">
      {initials(author.name)}
    </div>
  );
}

// ─── Pending (in-creation) pin ────────────────────────────────────────────

function PendingPin({
  xPct,
  yPx,
  currentUser,
  mentionable,
  route,
  onCancel,
  onCreated,
}: {
  xPct: number;
  yPx: number;
  currentUser: CurrentUser;
  mentionable: MentionableUser[];
  route: string;
  onCancel: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          route,
          anchorXPct: xPct,
          anchorYPx: yPx,
          body: text,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to post comment.");
        setSubmitting(false);
        return;
      }
      await onCreated();
    } catch {
      setError("Network error.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="pointer-events-auto absolute -translate-x-1 -translate-y-full"
        style={{ left: `${xPct * 100}%`, top: yPx }}
      >
        <div className="flex h-9 items-center justify-center rounded-full rounded-bl-sm border-2 border-card bg-primary px-2 text-primary-foreground shadow-[var(--shadow-popover)]">
          <PinAvatar
            author={{
              username: currentUser.username,
              name: currentUser.name,
              email: "",
              avatarUrl: currentUser.avatarUrl,
            }}
          />
        </div>
      </div>
      <PopoverFrame xPct={xPct} yPx={yPx}>
        <CommentComposer
          autoFocus
          value={body}
          onChange={setBody}
          mentionable={mentionable}
          submitting={submitting}
          submitLabel="Comment"
          onSubmit={submit}
          onCancel={onCancel}
        />
        {error && (
          <div className="px-3 pb-2 text-[12px] text-danger">{error}</div>
        )}
      </PopoverFrame>
    </>
  );
}

// ─── Open thread popover ──────────────────────────────────────────────────

function ThreadPopover({
  thread,
  currentUser,
  mentionable,
  mainRect,
  onClose,
  onMutated,
}: {
  thread: Thread;
  currentUser: CurrentUser;
  mentionable: MentionableUser[];
  mainRect: MainRect;
  onClose: () => void;
  onMutated: () => Promise<void>;
}) {
  const [reply, setReply] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownerOfThread = thread.createdBy === currentUser.username;

  async function submitReply() {
    const text = reply.trim();
    if (!text) return;
    setSubmittingReply(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/comments/threads/${encodeURIComponent(thread.id)}/replies`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: text }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to post reply.");
        setSubmittingReply(false);
        return;
      }
      setReply("");
      setSubmittingReply(false);
      await onMutated();
    } catch {
      setError("Network error.");
      setSubmittingReply(false);
    }
  }

  async function setResolved(next: boolean) {
    await fetch(`/api/comments/threads/${encodeURIComponent(thread.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolved: next }),
    });
    await onMutated();
  }

  async function deletePin() {
    if (!confirm("Delete this comment pin and all replies?")) return;
    await fetch(`/api/comments/threads/${encodeURIComponent(thread.id)}`, {
      method: "DELETE",
    });
    await onMutated();
    onClose();
  }

  // Wrapper at the pin's anchor — PopoverFrame handles flipping/position.
  return (
    <div
      className="pointer-events-none absolute z-[80]"
      style={{
        top: mainRect.pageTop,
        left: mainRect.pageLeft,
        width: mainRect.width,
        height: mainRect.height,
      }}
    >
      <PopoverFrame xPct={thread.anchorXPct} yPx={thread.anchorYPx}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={() => setResolved(!thread.resolved)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors",
              thread.resolved
                ? "bg-success-soft text-success hover:bg-success/20"
                : "text-muted hover:bg-accent hover:text-foreground",
            )}
            title={thread.resolved ? "Reopen thread" : "Resolve thread"}
          >
            <Check className="h-3.5 w-3.5" />
            {thread.resolved ? "Resolved" : "Resolve"}
          </button>
          <div className="flex items-center gap-0.5">
            {ownerOfThread && (
              <button
                type="button"
                onClick={deletePin}
                className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger transition-colors"
                title="Delete pin"
                aria-label="Delete pin"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="max-h-[40vh] overflow-y-auto">
          {thread.comments.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              isMine={c.author.username === currentUser.username}
              isEditing={editingId === c.id}
              mentionable={mentionable}
              onStartEdit={() => setEditingId(c.id)}
              onCancelEdit={() => setEditingId(null)}
              onSavedEdit={async () => {
                setEditingId(null);
                await onMutated();
              }}
              onDeleted={async () => {
                await onMutated();
                // If the thread itself was deleted (root + only comment),
                // close the popover. The next refresh will drop the row.
                if (thread.comments.length === 1) onClose();
              }}
            />
          ))}
        </div>

        <div className="border-t border-border">
          <CommentComposer
            value={reply}
            onChange={setReply}
            mentionable={mentionable}
            submitting={submittingReply}
            submitLabel="Reply"
            onSubmit={submitReply}
            placeholder="Reply…"
          />
          {error && (
            <div className="px-3 pb-2 text-[12px] text-danger">{error}</div>
          )}
        </div>
      </PopoverFrame>
    </div>
  );
}

// ─── A single comment row inside a thread ────────────────────────────────

function CommentRow({
  comment,
  isMine,
  isEditing,
  mentionable,
  onStartEdit,
  onCancelEdit,
  onSavedEdit,
  onDeleted,
}: {
  comment: Comment;
  isMine: boolean;
  isEditing: boolean;
  mentionable: MentionableUser[];
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSavedEdit: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) setDraft(comment.body);
  }, [isEditing, comment.body]);

  async function save() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    const res = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSaving(false);
    if (res.ok) await onSavedEdit();
  }

  async function del() {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments/${encodeURIComponent(comment.id)}`, {
      method: "DELETE",
    });
    if (res.ok) await onDeleted();
  }

  return (
    <div className="px-3 py-2.5 border-b border-border last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <PinAvatar author={comment.author} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {comment.author.name}
            </div>
            <div className="text-[11px] text-muted-soft">
              {formatRelative(comment.createdAt)}
              {comment.edited && <span className="ml-1">(edited)</span>}
            </div>
          </div>
          {!isEditing ? (
            <div className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground-soft">
              {renderBodyWithMentions(comment.body)}
            </div>
          ) : (
            <div className="mt-1">
              <CommentComposer
                value={draft}
                onChange={setDraft}
                mentionable={mentionable}
                submitting={saving}
                submitLabel="Save"
                onSubmit={save}
                onCancel={onCancelEdit}
                compact
                autoFocus
              />
            </div>
          )}
        </div>
        {isMine && !isEditing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground transition-colors"
              title="Edit"
              aria-label="Edit comment"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={del}
              className="rounded-md p-1 text-muted hover:bg-danger-soft hover:text-danger transition-colors"
              title="Delete"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composer with @-mention autocomplete ────────────────────────────────

function CommentComposer({
  value,
  onChange,
  mentionable,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  placeholder = "Add a comment…",
  compact = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  mentionable: MentionableUser[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    activeIdx: number;
  } | null>(null);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  // Auto-grow textarea up to a cap. Cheaper than a third-party autosize and
  // matches the popover's compact aesthetic.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [value]);

  function detectMention(text: string, caret: number) {
    // Walk backwards from caret to find an @-handle being typed.
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (ch === "@") {
        const before = i === 0 ? " " : text[i - 1];
        if (/\s|^/.test(before) || i === 0) {
          const query = text.slice(i + 1, caret);
          if (/^[a-z0-9._-]*$/i.test(query)) {
            return { start: i, query };
          }
        }
        return null;
      }
      if (/\s/.test(ch) || /[^a-z0-9._-]/i.test(ch)) {
        return null;
      }
      i--;
    }
    return null;
  }

  function onChangeText(next: string) {
    onChange(next);
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? next.length;
    const m = detectMention(next, caret);
    if (m) {
      setMentionState({ query: m.query, start: m.start, activeIdx: 0 });
    } else {
      setMentionState(null);
    }
  }

  const filteredMentions = useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.query.toLowerCase();
    return mentionable
      .filter(u => {
        if (!q) return true;
        return (
          u.username.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [mentionState, mentionable]);

  function insertMention(u: MentionableUser) {
    if (!mentionState) return;
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? value.length;
    const before = value.slice(0, mentionState.start);
    const after = value.slice(caret);
    const insert = `@${u.username} `;
    const next = before + insert + after;
    onChange(next);
    setMentionState(null);
    // Restore caret right after the inserted handle on the next paint.
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState(s =>
          s ? { ...s, activeIdx: Math.min(filteredMentions.length - 1, s.activeIdx + 1) } : s,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState(s => (s ? { ...s, activeIdx: Math.max(0, s.activeIdx - 1) } : s));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const u = filteredMentions[mentionState.activeIdx];
        if (u) insertMention(u);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!submitting && value.trim()) onSubmit();
      return;
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className={cn("relative", compact ? "p-1.5" : "p-2.5")}>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChangeText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        className={cn(
          "w-full resize-none bg-transparent text-[13px] leading-snug text-foreground placeholder:text-muted-soft outline-none",
          compact ? "min-h-[28px]" : "min-h-[36px]",
        )}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-soft">
          <kbd className="inline-flex items-center rounded border border-border bg-surface px-1 py-0.5 text-[10px] font-medium">
            @
          </kbd>{" "}
          to mention
        </div>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-2 py-1 text-[12px] text-muted hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !value.trim()}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              submitting || !value.trim()
                ? "bg-primary/40 text-primary-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary-hover",
            )}
          >
            {submitLabel}
            <CornerDownLeft className="h-3 w-3" />
          </button>
        </div>
      </div>
      {mentionState && filteredMentions.length > 0 && (
        <div className="absolute bottom-full left-2 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-popover)]">
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filteredMentions.map((u, i) => (
              <li key={u.username}>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors",
                    i === mentionState.activeIdx ? "bg-primary-soft" : "hover:bg-accent",
                  )}
                >
                  <PinAvatar
                    author={{
                      username: u.username,
                      name: u.name,
                      email: u.email,
                      avatarUrl: u.avatarUrl,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {u.name}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      @{u.username}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Popover frame (anchored to a pin) ────────────────────────────────────

function PopoverFrame({
  xPct,
  yPx,
  children,
}: {
  xPct: number;
  yPx: number;
  children: React.ReactNode;
}) {
  // Flip horizontally if the pin is on the right half so the popover doesn't
  // hang off-page. Width is fixed at 320px — Figma-ish.
  const flipRight = xPct > 0.6;
  return (
    <div
      className="pointer-events-auto absolute z-[80]"
      style={{
        left: `${xPct * 100}%`,
        top: yPx,
        transform: flipRight
          ? "translate(calc(-100% - 8px), 8px)"
          : "translate(28px, 8px)",
      }}
    >
      <div className="w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-popover)]">
        {children}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

type MainRect = {
  pageLeft: number;
  pageTop: number;
  width: number;
  height: number;
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const MENTION_RE = /(^|\s)@([a-z0-9._-]{2,40})/gi;

function renderBodyWithMentions(body: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const idx = m.index ?? 0;
    const lead = m[1] ?? "";
    const handle = m[2];
    const handleStart = idx + lead.length;
    if (handleStart > last) nodes.push(body.slice(last, handleStart));
    nodes.push(
      <span
        key={`m-${key++}`}
        className="rounded bg-primary-soft px-1 font-medium text-primary"
      >
        @{handle}
      </span>,
    );
    last = handleStart + 1 + handle.length;
  }
  if (last < body.length) nodes.push(body.slice(last));
  return nodes;
}
