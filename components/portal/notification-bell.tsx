"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: "mention";
  actorUsername: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  href: string;
  excerpt: string;
  route: string;
  threadId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 45_000;

export function NotificationBell({
  initialUnread,
  className,
}: {
  initialUnread: number;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotificationItem[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Ignore — next poll will retry.
    }
  }, []);

  // Background polling so the badge stays fresh even if the dropdown is never
  // opened. Stays at 45s; mentions aren't time-critical enough to justify a
  // tighter cadence.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  // Initial list fetch the first time the dropdown is opened — defers the
  // bigger payload until the user actually wants to read.
  const openPopover = useCallback(async () => {
    setOpen(true);
    if (items.length === 0) {
      setLoading(true);
      await refresh();
      setLoading(false);
    } else {
      // Background refresh on open to surface anything that's landed since.
      void refresh();
    }
  }, [items.length, refresh]);

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleItemClick = useCallback(
    async (item: NotificationItem) => {
      setOpen(false);
      // Optimistic: mark read locally so the badge updates immediately even
      // before the POST resolves.
      if (!item.readAt) {
        setItems(prev =>
          prev.map(n => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
        );
        setUnread(n => Math.max(0, n - 1));
        void fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [item.id] }),
        });
      }
      router.push(item.href);
    },
    [router],
  );

  const handleMarkAllRead = useCallback(async () => {
    // Optimistic: zero out locally while the request is in flight.
    setItems(prev => prev.map(n => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    setUnread(0);
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { unread: number };
        setUnread(data.unread);
      }
    } catch {
      // Next poll will reconcile.
    }
  }, []);

  const badge = useMemo(() => {
    if (unread <= 0) return null;
    return unread > 99 ? "99+" : String(unread);
  }, [unread]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? setOpen(false) : void openPopover())}
        className="relative rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors"
        title={unread > 0 ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications"}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {badge ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-card"
          >
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute bottom-full left-0 z-50 mb-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-sm font-medium text-foreground">Notifications</div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-accent hover:text-foreground transition-colors"
                title="Mark all as read"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted">
                No notifications yet. You&apos;ll see @mentions here.
              </li>
            ) : (
              items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors",
                      !item.readAt && "bg-primary/5",
                    )}
                  >
                    <ItemAvatar
                      name={item.actorName ?? item.actorUsername ?? "Someone"}
                      src={item.actorAvatarUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-foreground leading-snug">
                        <span className="font-medium">
                          {item.actorName ?? item.actorUsername ?? "Someone"}
                        </span>{" "}
                        <span className="text-muted">mentioned you</span>
                      </div>
                      {item.excerpt ? (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted leading-snug">
                          {item.excerpt}
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
                        <span>{relativeTime(item.createdAt)}</span>
                        <span>·</span>
                        <span className="truncate">{routeLabel(item.route)}</span>
                      </div>
                    </div>
                    {!item.readAt ? (
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                      />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ItemAvatar({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
    >
      {initials}
    </div>
  );
}

function relativeTime(iso: string): string {
  try {
    const d = parseSqlDate(iso);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

/** SQLite/LibSQL CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC
 *  with no timezone suffix. JS Date.parse handles ISO-with-T but not the
 *  space form on every browser, so normalise before parsing. */
function parseSqlDate(s: string): Date {
  if (s.includes("T")) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
}

function routeLabel(route: string): string {
  const noQuery = route.split("?")[0].split("#")[0];
  return noQuery || "/";
}
