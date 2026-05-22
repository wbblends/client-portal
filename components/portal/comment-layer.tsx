"use client";

/**
 * Lazy wrapper around the page-comments overlay.
 *
 * The overlay (`comment-overlay.tsx`) is ~1,100 lines of pins, popovers,
 * mention autocomplete and composer logic. It's mounted once in the portal
 * layout, so without this wrapper all of that code would ship in every page's
 * bundle even though comment mode is opt-in and most page views never touch
 * it.
 *
 * This wrapper ships only a small floating button + a couple of listeners. It
 * does the cheap per-route count fetch so the button can still show an
 * unresolved-comment badge, and it defers the heavy overlay chunk until the
 * user first enters comment mode (the `c` hotkey, a click on the button, or a
 * `?wbb_comment=` deep link). Once activated the overlay stays mounted.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageSquarePlus } from "lucide-react";

type CurrentUser = {
  username: string;
  name: string;
  avatarUrl: string | null;
};

const CommentOverlay = dynamic(
  () => import("./comment-overlay").then(m => m.CommentOverlay),
  { ssr: false },
);

export function CommentLayer({ currentUser }: { currentUser: CurrentUser }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activated, setActivated] = useState(false);
  const [unresolved, setUnresolved] = useState(0);

  // A `?wbb_comment=<id>` deep link should open straight into the overlay.
  useEffect(() => {
    if (searchParams.get("wbb_comment")) setActivated(true);
  }, [searchParams]);

  // `c` toggles comment mode. Pre-activation we only need it to mount the
  // overlay; once the overlay is up it owns the hotkey itself.
  useEffect(() => {
    if (activated) return;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "c") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setActivated(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activated]);

  // Lightweight per-route count so the button can show an unresolved badge
  // without loading the overlay. Skipped once the overlay takes over (it does
  // its own, richer fetch).
  useEffect(() => {
    if (activated) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/comments?route=${encodeURIComponent(pathname)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          threads?: { resolved: boolean }[];
        };
        if (cancelled) return;
        setUnresolved((data.threads ?? []).filter(t => !t.resolved).length);
      } catch {
        // Network blip — the badge just stays at its last value.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, activated]);

  if (activated) {
    return <CommentOverlay currentUser={currentUser} startMode="on" />;
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-[80] lg:bottom-4">
      <button
        type="button"
        onClick={() => setActivated(true)}
        className="group relative inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-[var(--shadow-popover)] transition-colors hover:bg-accent"
        title="Comment mode (C)"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Comment</span>
        <kbd className="ml-1 hidden sm:inline-flex items-center rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
          C
        </kbd>
        {unresolved > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
            {unresolved}
          </span>
        )}
      </button>
    </div>
  );
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}
