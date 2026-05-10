"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/chat/types";

type SearchHit = {
  conversationId: string;
  conversationName: string;
  senderName: string;
  message: Message;
};

export function ChatSearch({
  className,
  onNavigated,
}: {
  className?: string;
  onNavigated?: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = q.trim();
  const tooShort = trimmed.length < 2;
  // Show empty results immediately when the query is too short (derived state),
  // and only fetch on debounce when we have a long-enough query.
  const visibleHits = tooShort ? [] : hits;

  useEffect(() => {
    if (tooShort) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchHit[] };
        if (!cancelled) setHits(data.results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, tooShort]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-soft" />
      <input
        value={q}
        onChange={e => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search messages…"
        className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm placeholder:text-muted-soft focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
      />
      {q && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setHits([]);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-muted hover:bg-accent hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && !tooShort && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-[var(--shadow-popover)]">
          {loading && visibleHits.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted">Searching…</div>
          ) : visibleHits.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted">No matches.</div>
          ) : (
            <ul>
              {visibleHits.map(h => (
                <li key={h.message.id}>
                  <Link
                    href={`/chat/${h.conversationId}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigated?.();
                    }}
                    className="block px-3 py-2 hover:bg-accent"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground-soft">
                        {h.conversationName}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-soft tabular-nums">
                        {new Date(h.message.createdAt).toLocaleDateString([], {
                          month: "numeric",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="truncate text-sm text-foreground">
                      <span className="text-muted">{h.senderName}: </span>
                      {h.message.body || "(attachment)"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
