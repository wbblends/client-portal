"use client";

/**
 * Magical AI search bar — liquid-glass input that answers questions about
 * the portal by calling /api/ai-bot. SSE stream renders into a panel below.
 *
 * Design intent: a rotating conic-gradient sits *inside* the bar, heavily
 * blurred so it reads as swirling liquid; a translucent frosted-glass pane
 * floats on top, with the rainbow showing through. The swirl quickens and
 * brightens while the bot is thinking. Everything is clipped to the bar's
 * rounded rectangle (overflow:hidden) — nothing bleeds onto the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, ArrowRight, Loader2, X } from "lucide-react";

type StreamEvent =
  | { type: "tool_use"; tool: string }
  | { type: "tool_result"; tool: string; ok: boolean }
  | { type: "text"; delta: string }
  | {
      type: "done";
      usage: Record<string, number>;
    }
  | { type: "error"; message: string };

type ToolCallEntry = { tool: string; ok: boolean | null };

const TOOL_LABELS: Record<string, string> = {
  navigate_portal: "Looking up where to go",
  get_my_profile: "Reading your profile",
  get_pipeline_summary: "Checking the pipeline",
  get_typeform_leads: "Counting inbound leads",
  get_ad_traffic: "Pulling ad traffic",
  get_orders_portal_snapshot: "Scanning the order tracker",
};

// Lightweight markdown: bold + links. The bot is instructed to emit only
// these two; anything else renders as plain text.
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    // [label](url)
    const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          className="magical-link font-medium underline decoration-dotted underline-offset-2"
        >
          {linkMatch[1]}
        </a>,
      );
      i += linkMatch[0].length;
      continue;
    }
    // **bold**
    const boldMatch = text.slice(i).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {boldMatch[1]}
        </strong>,
      );
      i += boldMatch[0].length;
      continue;
    }
    // newline → break
    if (text[i] === "\n") {
      parts.push(<br key={key++} />);
      i++;
      continue;
    }
    // Plain character — accumulate until next special token to avoid
    // millions of single-char nodes.
    let end = i + 1;
    while (
      end < text.length &&
      text[end] !== "\n" &&
      !text.slice(end).startsWith("[") &&
      !text.slice(end).startsWith("**")
    ) {
      end++;
    }
    parts.push(text.slice(i, end));
    i = end;
  }
  return parts;
}

export function MagicalSearchBar({
  placeholder = "Ask Claude about your data, update your profile, and more!",
}: {
  placeholder?: string;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [tools, setTools] = useState<ToolCallEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd+/ focuses the bar (Cmd+K is taken by the existing command palette).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAnswer("");
    setTools([]);
    setError(null);
    setBusy(false);
  }, []);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || busy) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAnswer("");
    setTools([]);
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/ai-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        let msg = `Request failed (${res.status}).`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          // ignore JSON parse failure on non-JSON error responses
        }
        setError(msg);
        setBusy(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE chunks are separated by blank lines.
        let nl: number;
        while ((nl = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          const line = raw.startsWith("data: ") ? raw.slice(6) : raw;
          if (!line.trim()) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (evt.type === "text") {
            setAnswer(prev => prev + evt.delta);
          } else if (evt.type === "tool_use") {
            setTools(prev => [...prev, { tool: evt.tool, ok: null }]);
          } else if (evt.type === "tool_result") {
            setTools(prev => {
              const idx = [...prev]
                .reverse()
                .findIndex(t => t.tool === evt.tool && t.ok === null);
              if (idx === -1) return prev;
              const realIdx = prev.length - 1 - idx;
              const next = [...prev];
              next[realIdx] = { tool: evt.tool, ok: evt.ok };
              return next;
            });
          } else if (evt.type === "error") {
            setError(evt.message);
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [question, busy]);

  const hasOutput = !!answer || tools.length > 0 || !!error;

  return (
    <div className="magical-root w-full">
      <style>{`
        .magical-root { --magical-radius: 18px; }
        .magical-ring {
          position: relative;
          border-radius: var(--magical-radius);
          isolation: isolate;
          overflow: hidden;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.04),
            0 10px 28px -12px rgba(165, 120, 255, 0.28);
        }
        .magical-ring::before {
          /* Rainbow swirl contained inside the bar — the liquid behind the glass. */
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 220%;
          aspect-ratio: 1 / 1;
          transform: translate(-50%, -50%);
          background: conic-gradient(
            from 0deg,
            #ff6ec7,
            #ffb86c,
            #fff263,
            #6cf2a5,
            #6cd8ff,
            #a578ff,
            #ff6ec7
          );
          animation: magical-spin 14s linear infinite;
          filter: blur(38px) saturate(140%);
          opacity: 0.9;
          z-index: 0;
          pointer-events: none;
        }
        .magical-ring.is-busy::before {
          animation-duration: 5s;
          filter: blur(34px) saturate(170%);
          opacity: 1;
        }
        .magical-inner {
          position: relative;
          z-index: 1;
          border-radius: var(--magical-radius);
          background: color-mix(in srgb, var(--color-surface, #ffffff) 85%, transparent);
          backdrop-filter: saturate(160%) blur(22px);
          -webkit-backdrop-filter: saturate(160%) blur(22px);
          border: 1px solid color-mix(in srgb, #ffffff 55%, transparent);
          box-shadow:
            inset 0 1px 0 0 rgba(255, 255, 255, 0.55),
            inset 0 -1px 0 0 rgba(255, 255, 255, 0.08);
        }
        @keyframes magical-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .magical-input {
          background: transparent;
          border: 0;
          outline: 0;
          width: 100%;
        }
        .magical-input::placeholder { color: var(--color-muted, #6b7280); }
        .magical-panel {
          background: color-mix(in srgb, var(--color-surface, #ffffff) 94%, transparent);
          backdrop-filter: blur(12px) saturate(130%);
          -webkit-backdrop-filter: blur(12px) saturate(130%);
          border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        }
        .magical-link { color: var(--color-foreground, #111); }
        @media (prefers-reduced-motion: reduce) {
          .magical-ring::before { animation: none; }
        }
      `}</style>

      <div className={`magical-ring ${busy ? "is-busy" : ""}`}>
        <div className="magical-inner flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Sparkles
            className="h-5 w-5 shrink-0 text-foreground/70"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            className="magical-input text-sm sm:text-base text-foreground"
            placeholder={placeholder}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
              if (e.key === "Escape") {
                if (busy) abortRef.current?.abort();
                else reset();
              }
            }}
            disabled={false}
            aria-label="Ask the magical search bar"
          />
          <button
            type="button"
            onClick={() => (busy ? abortRef.current?.abort() : ask())}
            disabled={!busy && !question.trim()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30 hover:opacity-90"
            aria-label={busy ? "Stop" : "Ask"}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {hasOutput && (
        <div className="magical-panel mt-3 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {tools.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {tools.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-xs text-foreground/60"
                    >
                      <Sparkles
                        className={`h-3 w-3 ${t.ok === null ? "animate-pulse" : t.ok ? "text-emerald-500" : "text-amber-500"}`}
                      />
                      <span>
                        {TOOL_LABELS[t.tool] ?? t.tool}
                        {t.ok === null ? "…" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <div className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {answer ? (
                    renderInline(answer)
                  ) : (
                    <span className="text-foreground/40 italic">
                      thinking…
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Clear answer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
