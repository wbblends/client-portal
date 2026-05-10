"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Printer,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ZOOM_MIN = 60;
const ZOOM_MAX = 180;
const ZOOM_STEP = 10;

type Panel = null | "search" | "feedback";

/**
 * Floating per-page toolbar shown on every portal page. Lives in the (portal)
 * layout, so it persists across client-side navigations except for a forced
 * remount on pathname change (so search highlights / panels reset cleanly).
 *
 * - Find on page uses the CSS Custom Highlight API so we never mutate DOM
 *   inside React-managed subtrees.
 * - Zoom is applied to <main> via the CSS `zoom` property; the toolbar sits
 *   outside <main> so it stays a constant size.
 * - Export uses window.print() and relies on the @media print rules in
 *   globals.css to strip portal chrome.
 */
export function PageToolbar(props: { feedbackEmail?: string }) {
  const pathname = usePathname();
  // Remount on route change — clears panel state, search highlights, and
  // any zoom override without us having to manually reconcile them.
  return <PageToolbarInner key={pathname} {...props} />;
}

function PageToolbarInner({ feedbackEmail = "success@wbblends.com" }: { feedbackEmail?: string }) {
  const [zoom, setZoom] = useState(100);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const matchesRef = useRef<Range[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Apply zoom to <main>. Reset to default at 100% so we don't leave a stray
  // inline style that would defeat user-agent defaults.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const el = main as HTMLElement;
    if (zoom === 100) {
      el.style.removeProperty("zoom");
    } else {
      el.style.zoom = String(zoom / 100);
    }
  }, [zoom]);

  // Always clear highlights when the toolbar unmounts.
  useEffect(() => () => clearSearchHighlights(), []);

  // Keyboard shortcuts: Ctrl/Cmd+P to export, Ctrl/Cmd+F to find, Esc closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (isMod && k === "p") {
        e.preventDefault();
        clearSearchHighlights();
        setPanel(null);
        setQuery("");
        requestAnimationFrame(() => window.print());
      } else if (isMod && k === "f") {
        e.preventDefault();
        setPanel("search");
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (e.key === "Escape") {
        setPanel(curr => {
          if (curr) {
            setQuery("");
            clearSearchHighlights();
            matchesRef.current = [];
            setMatchCount(0);
            setActiveIdx(-1);
          }
          return null;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function runSearch(next: string) {
    setQuery(next);
    if (!next.trim()) {
      clearSearchHighlights();
      matchesRef.current = [];
      setMatchCount(0);
      setActiveIdx(-1);
      return;
    }
    const main = document.querySelector("main");
    if (!main) return;
    const found = findRanges(main, next);
    matchesRef.current = found;
    setMatchCount(found.length);
    const newActive = found.length > 0 ? 0 : -1;
    setActiveIdx(newActive);
    setHighlights(found, newActive >= 0 ? found[newActive] : null);
    if (newActive >= 0) scrollRangeIntoView(found[newActive]);
  }

  function stepMatch(dir: 1 | -1) {
    const found = matchesRef.current;
    if (found.length === 0) return;
    const next = (activeIdx + dir + found.length) % found.length;
    setActiveIdx(next);
    setHighlights(found, found[next]);
    scrollRangeIntoView(found[next]);
  }

  function closeSearch() {
    setPanel(null);
    setQuery("");
    clearSearchHighlights();
    matchesRef.current = [];
    setMatchCount(0);
    setActiveIdx(-1);
  }

  function exportPdf() {
    clearSearchHighlights();
    setPanel(null);
    setQuery("");
    requestAnimationFrame(() => window.print());
  }

  function togglePanel(p: Exclude<Panel, null>) {
    setPanel(curr => (curr === p ? null : p));
  }

  return (
    <div
      data-portal-toolbar
      className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 print:hidden lg:left-[calc(50%+130px)]"
    >
      {panel === "search" && (
        <SearchPanel
          inputRef={inputRef}
          query={query}
          onQueryChange={runSearch}
          matchCount={matchCount}
          activeIdx={activeIdx}
          onStep={stepMatch}
          onClose={closeSearch}
        />
      )}
      {panel === "feedback" && (
        <FeedbackPanel email={feedbackEmail} onClose={() => setPanel(null)} />
      )}

      <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-[var(--shadow-popover)]">
        <ToolbarButton
          label="Find on page"
          shortcut="Ctrl+F"
          onClick={() => togglePanel("search")}
          active={panel === "search"}
        >
          <Search className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Send feedback on this page"
          onClick={() => togglePanel("feedback")}
          active={panel === "feedback"}
        >
          <MessageSquare className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Zoom out"
          onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
        >
          <ZoomOut className="h-4 w-4" />
        </ToolbarButton>
        <button
          type="button"
          onClick={() => setZoom(100)}
          aria-label="Reset zoom to 100%"
          title="Reset zoom"
          className="min-w-[44px] rounded-md px-2 text-xs font-medium tabular-nums text-foreground-soft hover:text-foreground"
        >
          {zoom}%
        </button>
        <ToolbarButton
          label="Zoom in"
          onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
        >
          <ZoomIn className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Export page as PDF" shortcut="Ctrl+P" onClick={exportPdf}>
          <Printer className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

// ---------- Subcomponents ----------

function ToolbarButton({
  label,
  shortcut,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "rounded-full p-2 transition-colors",
          active
            ? "bg-primary-soft text-primary"
            : "text-foreground-soft hover:bg-accent hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-[var(--shadow-popover)] transition-opacity group-hover:opacity-100"
      >
        {label}
        {shortcut && <span className="ml-1.5 opacity-70">{shortcut}</span>}
      </span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />;
}

function SearchPanel({
  inputRef,
  query,
  onQueryChange,
  matchCount,
  activeIdx,
  onStep,
  onClose,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (v: string) => void;
  matchCount: number;
  activeIdx: number;
  onStep: (dir: 1 | -1) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="mb-2 flex items-center gap-1 rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-popover)]">
      <Search className="ml-1.5 h-4 w-4 text-muted" />
      <input
        ref={inputRef}
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder="Find on page…"
        className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-soft"
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            onStep(e.shiftKey ? -1 : 1);
          }
        }}
      />
      <div className="px-1 text-xs text-muted tabular-nums whitespace-nowrap min-w-[40px] text-right">
        {query
          ? matchCount === 0
            ? "0/0"
            : `${activeIdx + 1}/${matchCount}`
          : ""}
      </div>
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={matchCount === 0}
        className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Previous match"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={matchCount === 0}
        className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Next match"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground"
        aria-label="Close search"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function FeedbackPanel({ email, onClose }: { email: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const pathname = usePathname();
  const subject = `Portal feedback: ${pathname}`;
  const body = `${text}\n\n— Sent from ${pathname}`;
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="mb-2 w-[320px] rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-popover)]">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">Feedback on this page</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:bg-accent hover:text-foreground"
          aria-label="Close feedback"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        placeholder="What's working, what's not, what's missing?"
        className="w-full resize-none rounded-md border border-border bg-card px-2.5 py-2 text-sm placeholder:text-muted-soft focus:border-primary focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">Sends to {email}</span>
        <a
          href={href}
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Send
        </a>
      </div>
    </div>
  );
}

// ---------- Helpers: find-in-page via CSS Custom Highlight API ----------

type HighlightCtor = new (...ranges: Range[]) => unknown;
type HighlightRegistry = {
  set(name: string, hl: unknown): HighlightRegistry;
  delete(name: string): boolean;
};

function getHighlightApi(): { Highlight: HighlightCtor; registry: HighlightRegistry } | null {
  if (typeof window === "undefined") return null;
  const HL = (window as unknown as { Highlight?: HighlightCtor }).Highlight;
  const reg = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  if (!HL || !reg) return null;
  return { Highlight: HL, registry: reg };
}

function findRanges(root: Element, query: string): Range[] {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("[data-portal-toolbar]")) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      if (!(node.textContent ?? "").trim()) return NodeFilter.FILTER_REJECT;
      const cs = window.getComputedStyle(parent);
      if (cs.visibility === "hidden" || cs.display === "none") return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const ranges: Range[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n.textContent ?? "";
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const r = document.createRange();
      try {
        r.setStart(n, m.index);
        r.setEnd(n, m.index + m[0].length);
        ranges.push(r);
      } catch {
        // Indexes can become stale if the tree mutates mid-walk; skip.
      }
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return ranges;
}

function setHighlights(all: Range[], active: Range | null) {
  const api = getHighlightApi();
  if (!api) return;
  api.registry.delete("portal-search");
  api.registry.delete("portal-search-active");
  if (all.length > 0) {
    api.registry.set("portal-search", new api.Highlight(...all));
  }
  if (active) {
    api.registry.set("portal-search-active", new api.Highlight(active));
  }
}

function clearSearchHighlights() {
  const api = getHighlightApi();
  if (!api) return;
  api.registry.delete("portal-search");
  api.registry.delete("portal-search-active");
}

function scrollRangeIntoView(r: Range) {
  const rect = r.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;
  const visible =
    rect.top >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (visible) return;
  const top = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top, behavior: "smooth" });
}
