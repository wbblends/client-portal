"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Trash2, RotateCcw, Download, ChevronDown, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ORDERS_PORTAL_SEED,
  MONTHLY_TARGETS,
  MONTH_LABELS,
  MONTH_SHORT,
  TIERS,
  REP_SUGGESTIONS,
  CS_SUGGESTIONS,
  getRepColor,
  type OrdersPortalRow,
  type Tier,
  type OrderDraft,
} from "@/lib/data/orders-portal";
import { NewOrderForm } from "./new-order-form";

// v2 — schema changed (notes/health removed). Bumping the key avoids
// hydrating old rows that still carry those fields.
const STORAGE_KEY = "wbb.orders-portal.rows.v2";

/**
 * Editable, spreadsheet-style grid mirroring the "2026 POs" tab. Rows are
 * stored locally (localStorage) until the ERP integration replaces this with
 * a server-side fetch + mutation API. YTD, Remaining-to-Target, MTD, Q1..Q4,
 * and Target deltas are all derived live from the rows below.
 */
export function OrdersPortalGrid() {
  const [rows, setRows] = useState<OrdersPortalRow[]>(ORDERS_PORTAL_SEED);
  const [hydrated, setHydrated] = useState(false);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  /** Group rows visually by rep so the rep-color bands sit together. */
  const [groupByRep, setGroupByRep] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRows(parsed as OrdersPortalRow[]);
      }
    } catch {
      // ignore — fall through to seed
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      // quota / private mode — silently degrade to in-memory only
    }
  }, [rows, hydrated]);

  const updateRow = useCallback(
    (id: string, patch: Partial<OrdersPortalRow>) => {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
    },
    [],
  );

  const updateMonth = useCallback(
    (id: string, monthIdx: number, value: number | null) => {
      setRows(prev =>
        prev.map(r => {
          if (r.id !== id) return r;
          const months = r.months.slice();
          months[monthIdx] = value;
          return { ...r, months };
        }),
      );
    },
    [],
  );

  const addRow = () => {
    setRows(prev => [
      ...prev,
      {
        id: `r-new-${Date.now().toString(36)}`,
        customer: "",
        rep: "",
        cs: "",
        tier: "",
        projection: 0,
        months: Array(12).fill(null),
      },
    ]);
  };

  const deleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  /**
   * When the new-order form submits, fold the order revenue into the grid.
   * If a row already exists for that customer, bump the current month;
   * otherwise create a new row keyed off the form data.
   */
  const onOrderSubmit = (draft: OrderDraft) => {
    const monthIdx = new Date(draft.createdAt).getMonth();
    const revenue = draft.totalRevenue ?? 0;
    setRows(prev => {
      const matchIdx = prev.findIndex(
        r => r.customer.trim().toLowerCase() === draft.customer.trim().toLowerCase(),
      );
      if (matchIdx === -1) {
        const newRow: OrdersPortalRow = {
          id: `r-${draft.id}`,
          customer: draft.customer,
          rep: draft.rep,
          cs: draft.cs,
          tier: "",
          projection: revenue, // first projection = the order itself; user can edit
          months: Array(12).fill(null).map((_, i) => (i === monthIdx ? revenue : null)),
        };
        return [...prev, newRow];
      }
      const next = prev.slice();
      const existing = next[matchIdx];
      const months = existing.months.slice();
      months[monthIdx] = (months[monthIdx] ?? 0) + revenue;
      next[matchIdx] = {
        ...existing,
        rep: existing.rep || draft.rep,
        cs: existing.cs || draft.cs,
        months,
      };
      return next;
    });
  };

  const resetToSeed = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Reset all rows to the original 2026 POs snapshot? Local edits will be lost.")
    )
      return;
    setRows(ORDERS_PORTAL_SEED);
  };

  // Aggregates
  const monthTotals = useMemo(() => {
    const out = Array(12).fill(0);
    for (const r of rows) {
      for (let i = 0; i < 12; i++) out[i] += r.months[i] ?? 0;
    }
    return out;
  }, [rows]);

  const projectionTotal = useMemo(
    () => rows.reduce((s, r) => s + (r.projection || 0), 0),
    [rows],
  );

  const ytdGrand = useMemo(
    () => monthTotals.reduce((s, v) => s + v, 0),
    [monthTotals],
  );

  const targetGrand = useMemo(
    () => MONTHLY_TARGETS.reduce((s, v) => s + v, 0),
    [],
  );

  /**
   * Visible rows. When grouped by rep, rows are bucketed by rep and rep
   * groups are ordered by REP_SUGGESTIONS (then any leftovers alphabetically).
   * Otherwise, the natural order from the seed/edits is preserved.
   */
  const displayedRows = useMemo(() => {
    if (!groupByRep) return rows;
    const order = [...REP_SUGGESTIONS];
    const seen = new Set<string>(order);
    for (const r of rows) {
      const k = r.rep || "—";
      if (!seen.has(k)) {
        order.push(k);
        seen.add(k);
      }
    }
    const buckets = new Map<string, OrdersPortalRow[]>();
    for (const r of rows) {
      const k = r.rep || "—";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
    return order.flatMap(k => buckets.get(k) ?? []);
  }, [rows, groupByRep]);

  const quarters = useMemo(
    () => [
      { label: "Q1", actual: monthTotals[0] + monthTotals[1] + monthTotals[2], target: MONTHLY_TARGETS[0] + MONTHLY_TARGETS[1] + MONTHLY_TARGETS[2] },
      { label: "Q2", actual: monthTotals[3] + monthTotals[4] + monthTotals[5], target: MONTHLY_TARGETS[3] + MONTHLY_TARGETS[4] + MONTHLY_TARGETS[5] },
      { label: "Q3", actual: monthTotals[6] + monthTotals[7] + monthTotals[8], target: MONTHLY_TARGETS[6] + MONTHLY_TARGETS[7] + MONTHLY_TARGETS[8] },
      { label: "Q4", actual: monthTotals[9] + monthTotals[10] + monthTotals[11], target: MONTHLY_TARGETS[9] + MONTHLY_TARGETS[10] + MONTHLY_TARGETS[11] },
    ],
    [monthTotals],
  );

  const downloadCsv = () => {
    const header = [
      "Customer", "Rep", "CS", "Tier", "Projection",
      ...MONTH_LABELS, "YTD", "Remaining to Target",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const ytd = r.months.reduce<number>((s, v) => s + (v ?? 0), 0);
      const remaining = (r.projection || 0) - ytd;
      const cells = [
        csv(r.customer),
        csv(r.rep),
        csv(r.cs),
        csv(r.tier),
        r.projection,
        ...r.months.map(v => (v == null ? "" : v)),
        ytd,
        remaining,
      ];
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-portal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* KPI band — overall position vs plan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="YTD Booked"
          value={fmtCurrency(ytdGrand)}
          sub={`${pct(ytdGrand, projectionTotal)} of $${fmtCompact(projectionTotal)} projected`}
          tone="primary"
        />
        <KpiCard
          label="Target YTD"
          value={fmtCurrency(targetGrand)}
          sub="Sum of monthly targets"
          tone="muted"
        />
        <KpiCard
          label="Δ vs Target"
          value={`${ytdGrand - targetGrand >= 0 ? "+" : ""}${fmtCurrency(ytdGrand - targetGrand)}`}
          sub={ytdGrand >= targetGrand ? "On / ahead of plan" : "Behind plan"}
          tone={ytdGrand >= targetGrand ? "success" : "warning"}
        />
        <KpiCard
          label="Customers"
          value={String(rows.length)}
          sub={
            <span className="flex items-center gap-1.5 text-xs">
              <TierChip tier="AA" count={rows.filter(r => r.tier === "AA").length} />
              <TierChip tier="A" count={rows.filter(r => r.tier === "A").length} />
              <TierChip tier="B" count={rows.filter(r => r.tier === "B").length} />
              <TierChip tier="C" count={rows.filter(r => r.tier === "C").length} />
            </span>
          }
          tone="neutral"
        />
      </div>

      {/* Monthly totals strip — full year visible without scrolling the grid */}
      <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Monthly Booked vs Target</h2>
            <p className="mt-0.5 text-xs text-muted">
              Rolled up across all customers · green = at or above plan
            </p>
          </div>
          <div className="text-xs text-muted">
            <span className="text-foreground-soft font-medium">{fmtCurrency(ytdGrand)}</span> YTD
          </div>
        </header>
        <div className="grid grid-cols-6 lg:grid-cols-12 gap-2 px-3 pb-4">
          {MONTH_SHORT.map((m, i) => {
            const actual = monthTotals[i];
            const target = MONTHLY_TARGETS[i];
            const delta = actual - target;
            const onTrack = delta >= 0;
            const hasData = actual > 0;
            return (
              <div
                key={m}
                className={cn(
                  "rounded-lg border px-2.5 py-2 transition-colors",
                  hasData
                    ? onTrack
                      ? "border-success-soft bg-success-soft/40"
                      : "border-warning-soft bg-warning-soft/40"
                    : "border-border bg-accent/20",
                )}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {m}
                </div>
                <div
                  className={cn(
                    "mt-0.5 font-semibold tabular-nums leading-tight text-[13px]",
                    hasData ? "text-foreground" : "text-muted-soft",
                  )}
                >
                  {hasData ? fmtCurrencyShort(actual) : "—"}
                </div>
                <div className="mt-0.5 text-[10px] tabular-nums text-muted">
                  {hasData ? (
                    <span className={onTrack ? "text-success" : "text-warning"}>
                      {onTrack ? "+" : ""}
                      {fmtCurrencyShort(delta)}
                    </span>
                  ) : (
                    <span className="text-muted-soft">tgt {fmtCurrencyShort(target)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quarter cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quarters.map(q => {
          const delta = q.actual - q.target;
          const onTrack = delta >= 0;
          return (
            <div
              key={q.label}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {q.label}
                </div>
                <div
                  className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full",
                    onTrack
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {onTrack ? "+" : ""}
                  {fmtCurrencyShort(delta)}
                </div>
              </div>
              <div className="mt-2 text-[22px] font-semibold tabular-nums text-foreground">
                {fmtCurrency(q.actual)}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                of {fmtCurrency(q.target)} ({pct(q.actual, q.target)})
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-accent overflow-hidden">
                <div
                  className={cn("h-full rounded-full", onTrack ? "bg-success" : "bg-primary")}
                  style={{ width: `${Math.min(100, (q.actual / Math.max(1, q.target)) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-muted">
            <span className="text-foreground-soft font-medium">{rows.length}</span>{" "}
            customers · edits persist in your browser
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-foreground-soft cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupByRep}
              onChange={e => setGroupByRep(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-primary)]"
            />
            Group by rep
          </label>
          {/* Rep color legend */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted">
            {REP_SUGGESTIONS.map(r => {
              const tone = getRepColor(r);
              return (
                <span key={r} className="inline-flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                  {r}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={resetToSeed}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Add row
          </Button>
          <Button size="sm" variant="primary" onClick={() => setOrderFormOpen(true)}>
            <FilePlus2 className="h-3.5 w-3.5" />
            Enter new order
          </Button>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full border-separate border-spacing-0 text-[13px] tabular-nums">
          <thead>
            <tr className="bg-accent/40 text-[11px] uppercase tracking-wide text-muted">
              <Th sticky="left-0" className="w-10" />
              <Th sticky="left-10" className="min-w-[220px] border-l border-border">
                Customer
              </Th>
              <Th className="min-w-[120px]">Rep</Th>
              <Th className="min-w-[120px]">CS</Th>
              <Th className="w-[110px] text-center">Tier</Th>
              <Th className="text-right min-w-[140px]">Projection</Th>
              {MONTH_SHORT.map(m => (
                <Th key={m} className="text-right min-w-[128px]">
                  {m}
                </Th>
              ))}
              <Th className="text-right min-w-[140px] bg-primary-soft/60 text-primary">
                YTD
              </Th>
              <Th className="text-right min-w-[160px] bg-primary-soft/60 text-primary">
                Remaining
              </Th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, idx) => (
              <Row
                key={r.id}
                row={r}
                striped={idx % 2 === 1}
                onPatch={patch => updateRow(r.id, patch)}
                onMonth={(i, v) => updateMonth(r.id, i, v)}
                onDelete={() => deleteRow(r.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <NewOrderForm
        open={orderFormOpen}
        onClose={() => setOrderFormOpen(false)}
        customers={Array.from(
          new Set(rows.map(r => r.customer).filter(Boolean)),
        ).sort()}
        onSubmit={onOrderSubmit}
      />
    </div>
  );
}

/* --------------------------------- Row --------------------------------- */

function Row({
  row,
  striped,
  onPatch,
  onMonth,
  onDelete,
}: {
  row: OrdersPortalRow;
  striped: boolean;
  onPatch: (patch: Partial<OrdersPortalRow>) => void;
  onMonth: (i: number, v: number | null) => void;
  onDelete: () => void;
}) {
  const ytd = row.months.reduce<number>((s, v) => s + (v ?? 0), 0);
  const remaining = (row.projection || 0) - ytd;
  const overTarget = remaining < 0;
  const repTone = getRepColor(row.rep);

  return (
    <tr
      className={cn(
        "group transition-colors hover:bg-primary-soft/30",
        striped ? "bg-accent/15" : "bg-card",
      )}
    >
      <Td
        sticky="left-0"
        striped={striped}
        className={cn(
          "w-10 px-2 text-center border-l-4",
          repTone.accent,
        )}
      >
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-soft hover:text-danger transition-opacity p-1.5 rounded-md hover:bg-danger-soft"
          title="Delete row"
          aria-label={`Delete ${row.customer || "row"}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Td>

      <Td sticky="left-10" striped={striped} className="border-l border-border">
        <TextCell
          value={row.customer}
          onChange={v => onPatch({ customer: v })}
          placeholder="Customer name"
          bold
        />
      </Td>

      <Td striped={striped}>
        <RepCell
          value={row.rep}
          onChange={v => onPatch({ rep: v })}
        />
      </Td>

      <Td striped={striped}>
        <SuggestCell
          value={row.cs}
          options={CS_SUGGESTIONS}
          listId="dl-cs"
          onChange={v => onPatch({ cs: v })}
          placeholder="CS"
        />
      </Td>

      <Td striped={striped} className="text-center">
        <TierSelect value={row.tier} onChange={v => onPatch({ tier: v })} />
      </Td>

      <Td striped={striped} className="text-right">
        <NumberCell
          value={row.projection}
          onChange={v => onPatch({ projection: v ?? 0 })}
        />
      </Td>

      {row.months.map((v, i) => (
        <Td key={i} striped={striped} className="text-right">
          <NumberCell value={v} onChange={nv => onMonth(i, nv)} />
        </Td>
      ))}

      <Td striped={striped} className="text-right bg-primary-soft/40 font-semibold text-foreground">
        {ytd === 0 ? <span className="text-muted-soft font-normal">—</span> : fmtCurrency(ytd)}
      </Td>
      <Td
        striped={striped}
        className={cn(
          "text-right bg-primary-soft/40 font-semibold",
          overTarget ? "text-success" : "text-foreground",
        )}
      >
        {row.projection === 0 && ytd === 0 ? (
          <span className="text-muted-soft font-normal">—</span>
        ) : (
          fmtCurrency(remaining)
        )}
      </Td>
    </tr>
  );
}

/* --------------------------------- KPI --------------------------------- */

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone: "primary" | "muted" | "success" | "warning" | "neutral";
}) {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : tone === "muted"
            ? "text-foreground-soft"
            : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={cn("mt-2 text-[24px] font-semibold tabular-nums leading-tight", valueClass)}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

/**
 * Compact tier swatch used inside the customer-count KPI to give an
 * at-a-glance breakdown by tier with the same colors as the in-grid pills.
 */
function TierChip({ tier, count }: { tier: Tier; count: number }) {
  const tone =
    tier === "AA"
      ? "bg-emerald-600 text-white"
      : tier === "A"
        ? "bg-blue-600 text-white"
        : tier === "B"
          ? "bg-amber-400 text-amber-950"
          : "bg-rose-600 text-white";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center justify-center min-w-[24px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none",
          tone,
        )}
      >
        {tier}
      </span>
      <span className="tabular-nums text-foreground-soft">{count}</span>
    </span>
  );
}

/* -------------------------------- Cells -------------------------------- */

function TextCell({
  value,
  onChange,
  placeholder,
  bold,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded-md px-2 py-1.5 -mx-2 -my-1.5",
        bold ? "font-semibold text-foreground" : "text-foreground",
      )}
    />
  );
}

function NumberCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const display = value == null || value === 0 ? "" : fmtCurrency(value);

  return editing ? (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const cleaned = draft.replace(/[$,\s]/g, "");
        if (cleaned === "") {
          onChange(null);
        } else {
          const n = Number(cleaned);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === "Tab") (e.currentTarget as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value == null ? "" : String(value));
          setEditing(false);
        }
      }}
      className="w-full bg-transparent border-0 outline-none text-right focus:ring-2 focus:ring-primary/40 rounded-md px-2 py-1.5 -mx-2 -my-1.5 tabular-nums text-foreground"
    />
  ) : (
    <button
      type="button"
      onClick={() => {
        setDraft(value == null ? "" : String(value));
        setEditing(true);
      }}
      className={cn(
        "w-full text-right tabular-nums px-2 py-1.5 -mx-2 -my-1.5 rounded-md hover:bg-primary-soft/40 cursor-text block transition-colors",
        display ? "text-foreground" : "text-muted-soft",
      )}
    >
      {display || "—"}
    </button>
  );
}

/**
 * Tier pill — high-contrast, color-coded by tier so AA / A / B / C are
 * unmistakable at a glance. Built on a real <select> for keyboard support
 * but visually presented as a pill via a wrapper, which solves the cropping
 * issue caused by the native dropdown arrow eating padding.
 *
 *   AA = solid green   (priority / strategic)
 *   A  = solid blue    (strong account)
 *   B  = amber/yellow  (developing)
 *   C  = solid red     (small / early)
 */
function TierSelect({
  value,
  onChange,
}: {
  value: Tier | "";
  onChange: (v: Tier | "") => void;
}) {
  const tone =
    value === "AA"
      ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700"
      : value === "A"
        ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
        : value === "B"
          ? "bg-amber-400 text-amber-950 border-amber-500 hover:bg-amber-500"
          : value === "C"
            ? "bg-rose-600 text-white border-rose-700 hover:bg-rose-700"
            : "bg-card text-muted border-border hover:border-border-strong";
  return (
    <span
      className={cn(
        "relative inline-flex items-center gap-1 rounded-full border font-bold text-[12px] leading-none transition-colors min-w-[72px] h-7 px-3 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40",
        tone,
      )}
    >
      <span className="flex-1 text-center select-none">{value || "—"}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <select
        value={value}
        onChange={e => onChange(e.target.value as Tier | "")}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Tier"
      >
        <option value="">—</option>
        {TIERS.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Rep cell — combobox input that wears the rep's color as a soft chip
 * around the editable text. Supports adding new rep names while still
 * surfacing the canonical 5 as datalist suggestions.
 */
function RepCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tone = getRepColor(value);
  const known = REP_SUGGESTIONS.includes(value);
  return (
    <span
      className={cn(
        "inline-flex w-full items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
        value && known ? cn(tone.chip, tone.chipFg) : "bg-transparent text-foreground",
      )}
    >
      {value && known ? (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tone.dot)} />
      ) : null}
      <input
        type="text"
        list="dl-rep"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Rep"
        className={cn(
          "flex-1 min-w-0 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded px-0.5",
          value
            ? known
              ? "font-semibold"
              : "text-foreground"
            : "text-muted-soft",
        )}
      />
      <datalist id="dl-rep">
        {REP_SUGGESTIONS.map(o => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </span>
  );
}

function SuggestCell({
  value,
  options,
  listId,
  onChange,
  placeholder,
}: {
  value: string;
  options: readonly string[];
  listId: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded-md px-2 py-1.5 -mx-2 -my-1.5",
          value ? "text-foreground" : "text-muted-soft",
        )}
      />
      <datalist id={listId}>
        {options.map(o => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

/* ------------------------------ Helpers -------------------------------- */

function Th({
  children,
  className,
  sticky,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-3 text-left font-semibold border-b border-border whitespace-nowrap",
        sticky && `sticky ${sticky} z-20 bg-accent/60`,
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  sticky,
  striped,
}: {
  children?: React.ReactNode;
  className?: string;
  sticky?: string;
  striped?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 border-b border-border/60 align-middle",
        sticky && `sticky ${sticky} z-10`,
        sticky && (striped ? "bg-[color-mix(in_oklab,var(--color-accent)_15%,var(--color-card))]" : "bg-card"),
        className,
      )}
    >
      {children}
    </td>
  );
}

function fmtCurrency(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtCurrencyShort(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function csv(s: string) {
  if (s == null) return "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
