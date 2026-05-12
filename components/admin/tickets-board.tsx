"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type TicketColor = "red" | "white" | "gray" | null;

type Ticket = {
  id: string;
  tab: string;
  version: string;
  name: string;
  productType: string;
  customer: string;
  salesperson: string;
  status: string;
  openDate: string | null;
  dueDate: string | null;
  color: TicketColor;
  rank: number | null;
  lastSyncedAt: string;
  deletedAt: string | null;
};

const COLOR_CYCLE: TicketColor[] = [null, "red", "white", "gray"];

function nextColor(c: TicketColor): TicketColor {
  const i = COLOR_CYCLE.indexOf(c);
  return COLOR_CYCLE[(i + 1) % COLOR_CYCLE.length];
}

const ALL_TAB = "__all__";

export function TicketsBoard({
  initialTickets,
  initialLastSyncedAt,
}: {
  initialTickets: Ticket[];
  initialLastSyncedAt: string | null;
}) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    initialLastSyncedAt,
  );

  /** Track which (id, field) pairs have a pending edit, so the poll loop
   *  doesn't clobber a value the user is still typing. */
  const dirtyRef = useRef<Set<string>>(new Set());
  const pendingWritesRef = useRef(0);

  // Poll every 60s. PM tickets only change at the daily 7 AM sync, but we
  // want a freshly-syncing tab to pick up rank/color edits made by another
  // admin in a reasonable window.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (pendingWritesRef.current > 0) return;
      if (dirtyRef.current.size > 0) return;
      try {
        const res = await fetch("/api/tickets", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          tickets: Ticket[];
          lastSyncedAt: string | null;
        };
        if (!cancelled && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
          setLastSyncedAt(data.lastSyncedAt);
        }
      } catch {
        /* ignore — retry next tick */
      }
    };
    const id = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── Tabs derived from incoming data ──
  const tabs = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) set.add(t.tab || "—");
    return Array.from(set).sort();
  }, [tickets]);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);

  const visible = useMemo(() => {
    if (activeTab === ALL_TAB) return tickets;
    return tickets.filter(t => (t.tab || "—") === activeTab);
  }, [tickets, activeTab]);

  // ── Optimistic patch ──
  const patchTicket = useCallback(
    async (
      tab: string,
      id: string,
      patch: { color?: TicketColor; rank?: number | null },
    ) => {
      pendingWritesRef.current++;
      try {
        const res = await fetch(
          `/api/tickets/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...patch, tab }),
            cache: "no-store",
          },
        );
        if (!res.ok) {
          // Best-effort: refetch on error so we don't get out of sync.
          const re = await fetch("/api/tickets", { cache: "no-store" });
          if (re.ok) {
            const data = (await re.json()) as { tickets: Ticket[] };
            if (Array.isArray(data.tickets)) setTickets(data.tickets);
          }
        }
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      }
    },
    [],
  );

  const cycleColor = useCallback(
    (tab: string, id: string) => {
      const current = tickets.find(t => t.tab === tab && t.id === id);
      const target = nextColor(current?.color ?? null);
      setTickets(prev =>
        prev.map(t =>
          t.tab === tab && t.id === id ? { ...t, color: target } : t,
        ),
      );
      void patchTicket(tab, id, { color: target });
    },
    [tickets, patchTicket],
  );

  const setRank = useCallback(
    (tab: string, id: string, raw: string) => {
      const trimmed = raw.trim();
      let next: number | null;
      if (trimmed === "") {
        next = null;
      } else if (/^-?\d+$/.test(trimmed)) {
        next = parseInt(trimmed, 10);
      } else {
        return; // ignore non-integer input
      }
      dirtyRef.current.delete(`${tab}:${id}:rank`);
      setTickets(prev =>
        prev.map(t => (t.tab === tab && t.id === id ? { ...t, rank: next } : t)),
      );
      void patchTicket(tab, id, { rank: next });
    },
    [patchTicket],
  );

  // ── Drag-to-reorder ──
  // Drag is scoped within a single tab — you can't move a row across tabs
  // because each tab's ranks are independent. The key includes tab so the
  // matchers can't mistake same-id rows in different tabs for the same row.
  type DragKey = { tab: string; id: string };
  const [dragKey, setDragKey] = useState<DragKey | null>(null);
  const onDragStart = (k: DragKey) => () => setDragKey(k);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (target: DragKey) => async (e: React.DragEvent) => {
    e.preventDefault();
    const source = dragKey;
    setDragKey(null);
    if (!source) return;
    if (source.tab !== target.tab) return; // cross-tab drops not supported
    if (source.id === target.id) return;

    const inTab = visible.filter(t => t.tab === source.tab);
    const srcIdx = inTab.findIndex(t => t.id === source.id);
    const tgtIdx = inTab.findIndex(t => t.id === target.id);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = inTab.splice(srcIdx, 1);
    inTab.splice(tgtIdx, 0, moved);

    const newRanks: Array<{ id: string; rank: number }> = inTab.map((t, i) => ({
      id: t.id,
      rank: i + 1,
    }));

    setTickets(prev =>
      prev.map(t => {
        if (t.tab !== source.tab) return t;
        const hit = newRanks.find(r => r.id === t.id);
        return hit ? { ...t, rank: hit.rank } : t;
      }),
    );

    pendingWritesRef.current++;
    try {
      await Promise.all(
        newRanks.map(({ id, rank }) =>
          fetch(`/api/tickets/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ rank, tab: source.tab }),
            cache: "no-store",
          }).catch(() => null),
        ),
      );
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsRow
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          counts={countByTab(tickets)}
          totalCount={tickets.length}
        />
        <p className="text-xs text-muted">
          {lastSyncedAt
            ? `Last synced ${formatLastSynced(lastSyncedAt)}`
            : "No coworker sync yet — waiting on the first POST to /api/tickets/sync"}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-accent/30 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="text-left font-medium px-3 py-2 w-20">
                  Rank
                </th>
                <th scope="col" className="text-left font-medium px-2 py-2 w-10">
                  <span className="sr-only">Color</span>
                </th>
                <th scope="col" className="text-left font-medium px-3 py-2">ID</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Ver</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Name</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Product</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Customer</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Salesperson</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Status</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Open</th>
                <th scope="col" className="text-left font-medium px-3 py-2">Due</th>
                <th scope="col" className="px-2 py-2 w-6">
                  <span className="sr-only">Drag</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-sm text-muted"
                  >
                    No tickets yet. The 7&nbsp;AM coworker job will POST rows
                    to <code className="font-mono">/api/tickets/sync</code> and
                    they&apos;ll appear here.
                  </td>
                </tr>
              ) : (
                visible.map(t => {
                  const key = { tab: t.tab, id: t.id };
                  const rowKey = `${t.tab}:${t.id}`;
                  return (
                    <TicketRow
                      key={rowKey}
                      ticket={t}
                      showTabBadge={activeTab === ALL_TAB}
                      onCycleColor={() => cycleColor(t.tab, t.id)}
                      onRankChange={raw => setRank(t.tab, t.id, raw)}
                      onDragStart={onDragStart(key)}
                      onDragOver={onDragOver}
                      onDrop={onDrop(key)}
                      isDragging={
                        dragKey?.tab === t.tab && dragKey?.id === t.id
                      }
                      markDirty={() => dirtyRef.current.add(`${rowKey}:rank`)}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function TabsRow({
  tabs,
  active,
  onChange,
  counts,
  totalCount,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  counts: Map<string, number>;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TabPill
        label="All"
        count={totalCount}
        active={active === ALL_TAB}
        onClick={() => onChange(ALL_TAB)}
      />
      {tabs.map(t => (
        <TabPill
          key={t}
          label={t}
          count={counts.get(t) ?? 0}
          active={active === t}
          onClick={() => onChange(t)}
        />
      ))}
    </div>
  );
}

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border text-foreground-soft hover:border-border-strong hover:bg-accent",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
          active ? "bg-white/20" : "bg-accent text-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TicketRow({
  ticket,
  showTabBadge,
  onCycleColor,
  onRankChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  markDirty,
}: {
  ticket: Ticket;
  showTabBadge: boolean;
  onCycleColor: () => void;
  onRankChange: (raw: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  markDirty: () => void;
}) {
  const [localRank, setLocalRank] = useState<string>(
    ticket.rank == null ? "" : String(ticket.rank),
  );

  // Pull server-pushed rank back into the input when it's not being typed in.
  useEffect(() => {
    setLocalRank(ticket.rank == null ? "" : String(ticket.rank));
  }, [ticket.rank]);

  return (
    <tr
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(rowColorClass(ticket.color), isDragging && "opacity-50")}
      style={rowColorStyle(ticket.color)}
    >
      <td className="px-3 py-2 align-middle">
        <input
          type="text"
          inputMode="numeric"
          value={localRank}
          onChange={e => {
            setLocalRank(e.target.value);
            markDirty();
          }}
          onBlur={e => onRankChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="—"
          className={cn(
            "w-14 rounded-md border border-border bg-transparent px-2 py-1",
            "text-center font-bold tabular-nums",
            // Rank cell is intentionally 2 steps larger and bolder than body
            // copy (table is text-sm = 14px → rank is text-xl = 20px).
            "text-xl",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
          )}
          aria-label={`Rank for ${ticket.name || ticket.id}`}
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <button
          type="button"
          onClick={onCycleColor}
          aria-label={`Color: ${ticket.color ?? "none"} — click to cycle`}
          title={`Color: ${ticket.color ?? "none"}`}
          className={cn(
            "h-5 w-5 rounded-full border transition-shadow hover:shadow-md",
            colorSwatchClass(ticket.color),
          )}
        />
      </td>
      <td className="px-3 py-2 font-mono text-xs text-foreground">
        <div className="flex items-center gap-1.5">
          {showTabBadge && (
            <span className="rounded bg-accent/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              {ticket.tab}
            </span>
          )}
          <span>{ticket.id}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-muted">{ticket.version}</td>
      <td className="px-3 py-2 font-medium text-foreground">{ticket.name}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.productType}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.customer}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.salesperson}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.status}</td>
      <td className="px-3 py-2 tabular-nums text-xs text-muted">
        {fmtDate(ticket.openDate)}
      </td>
      <td className="px-3 py-2 tabular-nums text-xs text-muted">
        {fmtDate(ticket.dueDate)}
      </td>
      <td className="px-2 py-2 align-middle">
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          aria-label="Drag to reorder"
          className="cursor-grab text-muted-soft hover:text-foreground-soft active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function countByTab(tickets: Ticket[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tickets) {
    const k = t.tab || "—";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Row-color styling. We can't lean on Tailwind's `dark:` prefix — this app
 * toggles theme via `[data-theme="dark"]` on <html>, not Tailwind's
 * `.dark` class — so the row backgrounds are applied as inline styles with
 * rgba colors that read well on both light and dark surfaces. The class
 * piece just nudges text color where contrast demands it (the white band
 * needs forced-dark text in dark mode so it stays legible).
 */
function rowColorClass(c: TicketColor): string {
  switch (c) {
    case "white":
      // Force descendant text dark so a near-white band stays readable on
      // both themes. Tailwind arbitrary `[&_*]:` walks every descendant.
      return "[&_*]:!text-zinc-900";
    case "gray":
      return "text-foreground-soft";
    default:
      return "";
  }
}

function rowColorStyle(c: TicketColor): React.CSSProperties | undefined {
  switch (c) {
    case "red":
      // Warm red band — soft on light, glowy on dark.
      return { backgroundColor: "rgba(239, 68, 68, 0.18)" };
    case "white":
      // Near-white band — slightly off-white so it pops on both themes.
      return { backgroundColor: "rgba(250, 250, 250, 0.95)" };
    case "gray":
      return { backgroundColor: "rgba(120, 120, 130, 0.18)" };
    default:
      return undefined;
  }
}

function colorSwatchClass(c: TicketColor): string {
  switch (c) {
    case "red":
      return "bg-red-500 border-red-600";
    case "white":
      return "bg-white border-zinc-400";
    case "gray":
      return "bg-zinc-400 border-zinc-500";
    default:
      return "bg-transparent border-border-strong border-dashed";
  }
}

function fmtDate(s: string | null): string {
  // The coworker sends dates straight from the source spreadsheet (M/D/YY,
  // YYYY-MM-DD, ISO, whatever). Display them as-is — re-parsing risks
  // timezone shifts that change the visible day for no benefit.
  return s ?? "";
}

function formatLastSynced(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `today ${time}` : `${d.toLocaleDateString()} ${time}`;
}
