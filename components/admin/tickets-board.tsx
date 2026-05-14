"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ListFilter,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CompanyLogo } from "@/components/dashboards/deal-card";
import { customerDomainFor } from "@/lib/customers/registry";

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

// Explicit left-to-right order for the tab strip. A tab not in this list (e.g.
// a new sheet the coworker starts sending) sorts to the end alphabetically so
// it never silently disappears.
const TAB_ORDER = [
  "Quote",
  "Requote",
  "R&D",
  "FPS",
  "Document Request",
  "SFP",
  "Label Review",
  "Certification",
];

// ── Sorting ──
type SortKey =
  | "rank"
  | "id"
  | "version"
  | "name"
  | "productType"
  | "customer"
  | "salesperson"
  | "status"
  | "openDate"
  | "dueDate";
type SortDir = "asc" | "desc";

const DATE_SORT_KEYS = new Set<SortKey>(["openDate", "dueDate"]);

/**
 * Row comparator for an explicit column sort. Missing values (null rank, blank
 * strings, unparseable dates) always sort last regardless of direction, the
 * same way the server's default ordering pushes null ranks to the bottom.
 */
function compareTickets(a: Ticket, b: Ticket, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;

  if (key === "rank") {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return (a.rank - b.rank) * sign;
  }

  if (DATE_SORT_KEYS.has(key)) {
    const av = (key === "openDate" ? a.openDate : a.dueDate) ?? "";
    const bv = (key === "openDate" ? b.openDate : b.dueDate) ?? "";
    // Dates arrive as free-text from the source spreadsheet (M/D/YY, ISO, …).
    // Best-effort parse for ordering; fall back to string compare when a value
    // doesn't parse.
    const am = av ? Date.parse(av) : NaN;
    const bm = bv ? Date.parse(bv) : NaN;
    const aMiss = !Number.isFinite(am);
    const bMiss = !Number.isFinite(bm);
    if (aMiss && bMiss) return av.localeCompare(bv) * sign;
    if (aMiss) return 1;
    if (bMiss) return -1;
    return (am - bm) * sign;
  }

  const av = String(a[key] ?? "");
  const bv = String(b[key] ?? "");
  const aMiss = av.trim() === "";
  const bMiss = bv.trim() === "";
  if (aMiss && bMiss) return 0;
  if (aMiss) return 1;
  if (bMiss) return -1;
  return av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true }) * sign;
}

// ── Field filters ──
type FieldFilterKey = "customer" | "productType" | "salesperson" | "status";
const FIELD_FILTER_KEYS: FieldFilterKey[] = [
  "customer",
  "productType",
  "salesperson",
  "status",
];
const FIELD_FILTER_LABELS: Record<FieldFilterKey, string> = {
  customer: "Customer",
  productType: "Product",
  salesperson: "Salesperson",
  status: "Status",
};
type FilterState = Record<FieldFilterKey, string[]>;
const EMPTY_FILTERS: FilterState = {
  customer: [],
  productType: [],
  salesperson: [],
  status: [],
};

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

  // ── Tabs derived from incoming data, ordered by TAB_ORDER ──
  const tabs = useMemo(() => {
    const set = new Set<string>();
    for (const t of tickets) set.add(t.tab || "—");
    return Array.from(set).sort((a, b) => {
      const ai = TAB_ORDER.indexOf(a);
      const bi = TAB_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [tickets]);
  const [activeTab, setActiveTab] = useState<string>(tabs[0] ?? "");

  // Keep the active tab valid: on first load (empty initial tickets) and if the
  // selected tab disappears from a later sync, fall back to the first tab.
  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);

  // ── Sort state ──
  // Rank-ascending is the default "natural" view: it's the only ordering in
  // which the rank input and drag-to-reorder are live. Any other sort is a
  // read-only view of the same rows.
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir(d => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  // ── Field filter state ──
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Filter options are derived from the full ticket set (not the active tab)
  // so a selected value doesn't vanish from the dropdown when you switch tabs.
  const filterOptions = useMemo(() => {
    const distinct = (pick: (t: Ticket) => string) =>
      Array.from(
        new Set(tickets.map(t => pick(t).trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return {
      customer: distinct(t => t.customer),
      productType: distinct(t => t.productType),
      salesperson: distinct(t => t.salesperson),
      status: distinct(t => t.status),
    } as Record<FieldFilterKey, string[]>;
  }, [tickets]);

  const activeFilterCount = useMemo(
    () => FIELD_FILTER_KEYS.reduce((n, k) => n + filters[k].length, 0),
    [filters],
  );
  const hasFieldFilters = activeFilterCount > 0;

  const toggleFilterValue = useCallback(
    (key: FieldFilterKey, value: string) => {
      setFilters(prev => {
        const cur = prev[key];
        const next = cur.includes(value)
          ? cur.filter(v => v !== value)
          : [...cur, value];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const clearFilterKey = useCallback((key: FieldFilterKey) => {
    setFilters(prev => (prev[key].length === 0 ? prev : { ...prev, [key]: [] }));
  }, []);

  const clearAllFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  // ── Visible rows: active tab → field filters → sort ──
  const rows = useMemo(() => {
    let r = tickets.filter(t => (t.tab || "—") === activeTab);

    for (const key of FIELD_FILTER_KEYS) {
      const sel = filters[key];
      if (sel.length > 0) r = r.filter(t => sel.includes(t[key].trim()));
    }

    // Rank-ascending keeps the server ordering as-is (tab-grouped, null ranks
    // last, then due date, then id) so drag-to-reorder math stays correct.
    if (sortKey === "rank" && sortDir === "asc") return r;
    return [...r].sort((a, b) => compareTickets(a, b, sortKey, sortDir));
  }, [tickets, activeTab, filters, sortKey, sortDir]);

  // The rank input is live in any Rank view; drag-to-reorder additionally
  // requires the natural Rank ↑ order with no field filters, because it
  // renumbers rows by their visible position within a tab.
  const inRankView = sortKey === "rank";
  const canReorder = inRankView && sortDir === "asc" && !hasFieldFilters;

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
  // It's only wired up when `canReorder` is true (Rank ↑ view, no filters).
  type DragKey = { tab: string; id: string };
  const [dragKey, setDragKey] = useState<DragKey | null>(null);
  const onDragStart = (k: DragKey) => () => setDragKey(k);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (target: DragKey) => async (e: React.DragEvent) => {
    e.preventDefault();
    const source = dragKey;
    setDragKey(null);
    if (!canReorder) return; // sorted/filtered view — reordering disabled
    if (!source) return;
    if (source.tab !== target.tab) return; // cross-tab drops not supported
    if (source.id === target.id) return;

    const inTab = rows.filter(t => t.tab === source.tab);
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
        />
        <p className="text-xs text-muted">
          {lastSyncedAt
            ? `Last synced ${formatLastSynced(lastSyncedAt)}`
            : "No coworker sync yet — waiting on the first POST to /api/tickets/sync"}
        </p>
      </div>

      {tickets.length > 0 && (
        <FilterBar
          options={filterOptions}
          filters={filters}
          onToggle={toggleFilterValue}
          onClearKey={clearFilterKey}
          onClearAll={clearAllFilters}
          activeFilterCount={activeFilterCount}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-accent/30 text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortableTh
                  label="Rank"
                  columnKey="rank"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                  className="w-24"
                />
                <th scope="col" className="text-left font-medium px-2 py-2 w-10">
                  <span className="sr-only">Color</span>
                </th>
                <SortableTh label="ID" columnKey="id" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Ver" columnKey="version" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Name" columnKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Product" columnKey="productType" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Customer" columnKey="customer" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Salesperson" columnKey="salesperson" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Status" columnKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Open" columnKey="openDate" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortableTh label="Due" columnKey="dueDate" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <th scope="col" className="px-2 py-2 w-6">
                  <span className="sr-only">Drag</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-sm text-muted"
                  >
                    {tickets.length === 0 ? (
                      <>
                        No tickets yet. The 7&nbsp;AM coworker job will POST
                        rows to{" "}
                        <code className="font-mono">/api/tickets/sync</code> and
                        they&apos;ll appear here.
                      </>
                    ) : (
                      "No tickets match the current tab and filters."
                    )}
                  </td>
                </tr>
              ) : (
                rows.map(t => {
                  const key = { tab: t.tab, id: t.id };
                  const rowKey = `${t.tab}:${t.id}`;
                  return (
                    <TicketRow
                      key={rowKey}
                      ticket={t}
                      inRankView={inRankView}
                      canReorder={canReorder}
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

function SortableTh({
  label,
  columnKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  columnKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === columnKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("text-left font-medium px-3 py-2", className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "group inline-flex items-center gap-1 -mx-1 px-1 py-0.5 rounded transition-colors",
          "hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          active && "text-foreground",
        )}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-40" />
        )}
      </button>
    </th>
  );
}

function FilterBar({
  options,
  filters,
  onToggle,
  onClearKey,
  onClearAll,
  activeFilterCount,
}: {
  options: Record<FieldFilterKey, string[]>;
  filters: FilterState;
  onToggle: (key: FieldFilterKey, value: string) => void;
  onClearKey: (key: FieldFilterKey) => void;
  onClearAll: () => void;
  activeFilterCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
        <ListFilter className="h-3.5 w-3.5" />
        Filters
      </span>
      {FIELD_FILTER_KEYS.map(key => (
        <MultiSelectFilter
          key={key}
          label={FIELD_FILTER_LABELS[key]}
          options={options[key]}
          selected={filters[key]}
          onToggle={value => onToggle(key, value)}
          onClear={() => onClearKey(key)}
        />
      ))}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear all ({activeFilterCount})
        </button>
      )}
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = selected.length;
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
          count > 0
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-card text-foreground-soft hover:border-border-strong hover:bg-accent",
        )}
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
            {count}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">No values to filter.</p>
            ) : (
              options.map(opt => {
                const checked = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onToggle(opt)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-foreground-soft" title={opt}>
                      {opt}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabsRow({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
  counts: Map<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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

/** Customer logo cell. Resolves the free-text customer name to a domain and
 *  renders the same favicon-based logo the pipeline uses; falls back to a
 *  neutral placeholder box (matching the pipeline's stale-deals table) so the
 *  column stays aligned when no domain is on file. */
function TicketCustomerLogo({ customer }: { customer: string }) {
  const domain = customerDomainFor(customer);
  if (domain) {
    return <CompanyLogo domain={domain} name={customer || null} />;
  }
  return (
    <div className="h-6 w-6 shrink-0 rounded border border-border bg-surface" />
  );
}

function TicketRow({
  ticket,
  inRankView,
  canReorder,
  onCycleColor,
  onRankChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  markDirty,
}: {
  ticket: Ticket;
  inRankView: boolean;
  canReorder: boolean;
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
        {inRankView ? (
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
        ) : (
          // Read-only while the table is sorted by another column — rank is
          // only editable in a Rank view.
          <span
            className="inline-block w-14 text-center text-xl font-bold tabular-nums text-muted"
            title="Switch to Rank sort to edit"
          >
            {ticket.rank == null ? "—" : ticket.rank}
          </span>
        )}
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
        {ticket.id}
      </td>
      <td className="px-3 py-2 text-xs text-muted">{ticket.version}</td>
      <td className="px-3 py-2 font-medium text-foreground">{ticket.name}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.productType}</td>
      <td className="px-3 py-2 text-foreground-soft">
        <div className="flex items-center gap-2">
          <TicketCustomerLogo customer={ticket.customer} />
          <span className="truncate" title={ticket.customer}>
            {ticket.customer}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.salesperson}</td>
      <td className="px-3 py-2 text-foreground-soft">{ticket.status}</td>
      <td className="px-3 py-2 tabular-nums text-xs text-muted">
        {fmtDate(ticket.openDate)}
      </td>
      <td className="px-3 py-2 tabular-nums text-xs text-muted">
        {fmtDate(ticket.dueDate)}
      </td>
      <td className="px-2 py-2 align-middle">
        {canReorder ? (
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            aria-label="Drag to reorder"
            className="cursor-grab text-muted-soft hover:text-foreground-soft active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span
            className="block h-4 w-4"
            aria-hidden="true"
            title="Switch to Rank ↑ with no filters to reorder"
          />
        )}
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
