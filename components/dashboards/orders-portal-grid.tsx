"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Download,
  ChevronDown,
  FilePlus2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
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

type MonthCol =
  | { kind: "actual"; monthIdx: number }
  | { kind: "forecast"; monthIdx: number };

/**
 * Editable, spreadsheet-style grid mirroring the "2026 POs" tab. Rows live in
 * the `orders_portal_rows` table â€” any admin's edit becomes visible to every
 * other user on their next poll (every 10s). Read-only viewers see the same
 * data but can't change it. YTD, Remaining-to-Target, MTD, Q1..Q4, current-
 * month thermometer, and column auto-sums are all derived live from the rows
 * below.
 */
export function OrdersPortalGrid({
  initialRows,
  canEdit,
}: {
  initialRows: OrdersPortalRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<OrdersPortalRow[]>(initialRows);
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  /** Group rows visually by rep so the rep-color bands sit together. */
  const [groupByRep, setGroupByRep] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * Track which row.field combinations have a pending local edit. While a
   * cell is "dirty" (mid-typing) the poll loop won't clobber it with the
   * server's older value. Cleared when the PATCH for that row resolves.
   */
  const dirtyRef = useRef<Set<string>>(new Set());

  // â”€â”€ Polling: every 10s pick up edits from other users. We pause polling
  // while there's a pending write so we don't race our own optimistic update.
  const pendingWritesRef = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (pendingWritesRef.current > 0) return;
      if (dirtyRef.current.size > 0) return;
      try {
        const res = await fetch("/api/orders-portal/rows", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { rows: OrdersPortalRow[] };
        if (!cancelled && Array.isArray(data.rows)) {
          setRows(data.rows);
        }
      } catch {
        // ignore â€” next tick will retry
      }
    };
    const id = setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // â”€â”€ Mutations through the API. All write helpers patch local state
  // optimistically, then send the change to the server. canEdit guards the
  // UI affordances; the server also enforces admin-only writes.
  const patchRow = useCallback(
    async (id: string, patch: Partial<OrdersPortalRow>) => {
      pendingWritesRef.current += 1;
      try {
        const res = await fetch(`/api/orders-portal/rows/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setSyncError(data.error ?? "Save failed â€” your edit hasn't been shared yet.");
        } else {
          setSyncError(null);
        }
      } catch {
        setSyncError("Network error â€” your edit hasn't been shared yet.");
      } finally {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
        // Clear dirty markers for this row so polling can refresh it again.
        const prefix = `${id}.`;
        for (const k of Array.from(dirtyRef.current)) {
          if (k.startsWith(prefix)) dirtyRef.current.delete(k);
        }
      }
    },
    [],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<OrdersPortalRow>) => {
      // Mark every patched field dirty so a poll mid-flight won't revert.
      for (const k of Object.keys(patch)) dirtyRef.current.add(`${id}.${k}`);
      setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
      void patchRow(id, patch);
    },
    [patchRow],
  );

  const updateMonth = useCallback(
    (id: string, monthIdx: number, value: number | null) => {
      dirtyRef.current.add(`${id}.months`);
      setRows(prev => {
        const next = prev.map(r => {
          if (r.id !== id) return r;
          const months = r.months.slice();
          months[monthIdx] = value;
          return { ...r, months };
        });
        const updated = next.find(r => r.id === id);
        if (updated) void patchRow(id, { months: updated.months });
        return next;
      });
    },
    [patchRow],
  );

  const updateForecast = useCallback(
    (id: string, monthIdx: number, value: number | null) => {
      dirtyRef.current.add(`${id}.forecasts`);
      setRows(prev => {
        const next = prev.map(r => {
          if (r.id !== id) return r;
          const forecasts = (r.forecasts ?? Array(12).fill(null)).slice();
          forecasts[monthIdx] = value;
          return { ...r, forecasts };
        });
        const updated = next.find(r => r.id === id);
        if (updated) void patchRow(id, { forecasts: updated.forecasts });
        return next;
      });
    },
    [patchRow],
  );

  const addRow = async () => {
    pendingWritesRef.current += 1;
    try {
      const res = await fetch("/api/orders-portal/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: {
            customer: "",
            rep: "",
            cs: "",
            tier: "",
            projection: 0,
            months: Array(12).fill(null),
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(data.error ?? "Couldn't add a row.");
        return;
      }
      const { row } = (await res.json()) as { row: OrdersPortalRow };
      setRows(prev => [...prev, row]);
      setSyncError(null);
    } catch {
      setSyncError("Network error â€” couldn't add a row.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  const deleteRow = async (id: string) => {
    // Optimistic remove.
    setRows(prev => prev.filter(r => r.id !== id));
    pendingWritesRef.current += 1;
    try {
      const res = await fetch(`/api/orders-portal/rows/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(data.error ?? "Couldn't delete that row.");
      } else {
        setSyncError(null);
      }
    } catch {
      setSyncError("Network error â€” couldn't delete that row.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  /**
   * When the new-order form submits, hand the order to the server which
   * folds it into the appropriate row (creating a customer row if needed).
   * The response carries the canonical row so we can update local state in
   * one shot â€” no double-write.
   */
  const onOrderSubmit = async (draft: OrderDraft) => {
    pendingWritesRef.current += 1;
    try {
      const res = await fetch("/api/orders-portal/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "order",
          customer: draft.customer,
          rep: draft.rep,
          cs: draft.cs,
          revenue: draft.totalRevenue ?? 0,
          createdAt: draft.createdAt,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(data.error ?? "Order didn't sync â€” try again.");
        return;
      }
      const { row, created } = (await res.json()) as {
        row: OrdersPortalRow;
        created: boolean;
      };
      setRows(prev => {
        if (created) return [...prev, row];
        return prev.map(r => (r.id === row.id ? row : r));
      });
      setSyncError(null);
    } catch {
      setSyncError("Network error â€” order didn't sync.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  const resetToSeed = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reset all rows to the original 2026 POs snapshot? This affects every user.",
      )
    ) {
      return;
    }
    pendingWritesRef.current += 1;
    try {
      const res = await fetch("/api/orders-portal/reset", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSyncError(data.error ?? "Couldn't reset the grid.");
        return;
      }
      const { rows: fresh } = (await res.json()) as { rows: OrdersPortalRow[] };
      setRows(fresh);
      setSyncError(null);
    } catch {
      setSyncError("Network error â€” couldn't reset the grid.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  // â”€â”€ Aggregates
  const monthTotals = useMemo(() => {
    const out = Array(12).fill(0);
    for (const r of rows) {
      for (let i = 0; i < 12; i++) out[i] += r.months[i] ?? 0;
    }
    return out;
  }, [rows]);

  const forecastTotals = useMemo(() => {
    const out = Array(12).fill(0);
    for (const r of rows) {
      const f = r.forecasts ?? [];
      for (let i = 0; i < 12; i++) out[i] += f[i] ?? 0;
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

  const targetGrand = useMemo(() => MONTHLY_TARGETS.reduce((s, v) => s + v, 0), []);

  // Today's month â€” drives the "Orders this month" / "Orders target" pair and
  // the thermometer at the top of the page. Initialized after mount so the
  // user's clock (not the server's) decides which month is "current"; avoids
  // a hydration mismatch at the month boundary across timezones.
  const [currentMonthIdx, setCurrentMonthIdx] = useState(() => {
    if (typeof window === "undefined") return new Date().getMonth();
    return new Date().getMonth();
  });
  useEffect(() => {
    setCurrentMonthIdx(new Date().getMonth());
  }, []);
  const currentMonthLabel = MONTH_LABELS[currentMonthIdx];
  const monthActual = monthTotals[currentMonthIdx];
  const monthTarget = MONTHLY_TARGETS[currentMonthIdx];
  const monthProgress = monthTarget > 0 ? monthActual / monthTarget : 0;

  /**
   * Rolling 90-day forecast window: current month plus the next two, clipped
   * to December. The current month keeps its actual column; the +1 and +2
   * future months have their actual columns hidden and their forecast columns
   * inserted in their place (alongside the current-month forecast).
   */
  const forecastWindow = useMemo<number[]>(() => {
    const out: number[] = [];
    for (let k = 0; k < 3; k++) {
      const idx = currentMonthIdx + k;
      if (idx < 12) out.push(idx);
    }
    return out;
  }, [currentMonthIdx]);

  const monthColumns = useMemo<MonthCol[]>(() => {
    const hiddenActuals = new Set(forecastWindow.slice(1));
    const cols: MonthCol[] = [];
    for (let i = 0; i < 12; i++) {
      if (!hiddenActuals.has(i)) cols.push({ kind: "actual", monthIdx: i });
      if (i === currentMonthIdx) {
        for (const fIdx of forecastWindow) cols.push({ kind: "forecast", monthIdx: fIdx });
      }
    }
    return cols;
  }, [currentMonthIdx, forecastWindow]);

  /** Visible rows. When grouped by rep, rows are bucketed by rep and rep
   *  groups are ordered by REP_SUGGESTIONS (then any leftovers alphabetically).
   *  Otherwise, the natural server order is preserved. */
  const displayedRows = useMemo(() => {
    if (!groupByRep) return rows;
    const order = [...REP_SUGGESTIONS];
    const seen = new Set<string>(order);
    for (const r of rows) {
      const k = r.rep || "â€”";
      if (!seen.has(k)) {
        order.push(k);
        seen.add(k);
      }
    }
    const buckets = new Map<string, OrdersPortalRow[]>();
    for (const r of rows) {
      const k = r.rep || "â€”";
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
    const forecastHeaders = forecastWindow.map(i => `${MONTH_LABELS[i]} Forecast`);
    const header = [
      "Customer", "Rep", "CS", "Tier", "Projection",
      ...MONTH_LABELS, ...forecastHeaders, "YTD", "Remaining to Target",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const ytd = r.months.reduce<number>((s, v) => s + (v ?? 0), 0);
      const remaining = (r.projection || 0) - ytd;
      const f = r.forecasts ?? [];
      const cells = [
        csv(r.customer),
        csv(r.rep),
        csv(r.cs),
        csv(r.tier),
        r.projection,
        ...r.months.map(v => (v == null ? "" : v)),
        ...forecastWindow.map(i => (f[i] == null ? "" : f[i])),
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
      {/* â”€â”€ Current-month focus card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Full-width card styled like the Quarter cards below: short label +
          delta chip on top, big actual number, "of $target (pct%)" sub line,
          and a progress bar at the bottom. */}
      {(() => {
        const delta = monthActual - monthTarget;
        const onTrack = delta >= 0;
        return (
          <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {currentMonthLabel}
              </div>
              <div
                className={cn(
                  "text-[12px] font-medium px-2.5 py-0.5 rounded-full",
                  onTrack
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning",
                )}
              >
                {onTrack ? "+" : ""}
                {fmtCurrencyShort(delta)}
              </div>
            </div>
            <div className="mt-2 text-[32px] font-semibold tabular-nums leading-tight text-foreground">
              {fmtCurrency(monthActual)}
            </div>
            <div className="mt-0.5 text-sm text-muted">
              of {fmtCurrency(monthTarget)} ({pct(monthActual, monthTarget)})
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-accent overflow-hidden">
              <div
                className={cn("h-full rounded-full", onTrack ? "bg-success" : "bg-primary")}
                style={{
                  width: `${Math.min(100, monthProgress * 100)}%`,
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* â”€â”€ Quarter cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Monthly Booked vs Target (below the Quarters) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <header className="flex items-center justify-between px-5 pt-4 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Monthly Booked vs Target</h2>
            <p className="mt-0.5 text-xs text-muted">
              Rolled up across all customers Â· green = at or above plan Â·
              YTD <span className="text-foreground-soft font-medium">{fmtCurrency(ytdGrand)}</span>
              {" "}of <span className="text-foreground-soft font-medium">{fmtCurrency(targetGrand)}</span>
            </p>
          </div>
          <div className="text-xs text-muted">
            <span
              className={cn(
                "font-medium",
                ytdGrand >= targetGrand ? "text-success" : "text-warning",
              )}
            >
              {ytdGrand >= targetGrand ? "+" : ""}
              {fmtCurrencyShort(ytdGrand - targetGrand)}
            </span>{" "}
            vs YTD plan
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
                  {hasData ? fmtCurrencyShort(actual) : "â€”"}
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

      {/* â”€â”€ Toolbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-muted">
            <span className="text-foreground-soft font-medium">{rows.length}</span>{" "}
            customers Â·{" "}
            {canEdit ? (
              <span>edits sync to every user</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-foreground-soft">
                <Lock className="h-3 w-3" /> read-only
              </span>
            )}
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
          {syncError && (
            <span className="text-xs text-danger font-medium" role="status">
              {syncError}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canEdit && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* â”€â”€ Spreadsheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              {monthColumns.map((col, idx) =>
                col.kind === "actual" ? (
                  <Th
                    key={`a-${col.monthIdx}-${idx}`}
                    className="text-right min-w-[128px]"
                  >
                    {MONTH_SHORT[col.monthIdx]}
                  </Th>
                ) : (
                  <Th
                    key={`f-${col.monthIdx}-${idx}`}
                    className="text-right min-w-[128px] bg-warning-soft/70 text-warning"
                  >
                    {MONTH_SHORT[col.monthIdx]} fcst
                  </Th>
                ),
              )}
              <Th className="text-right min-w-[140px] bg-primary-soft/60 text-primary">
                YTD
              </Th>
              <Th className="text-right min-w-[160px] bg-primary-soft/60 text-primary">
                Remaining
              </Th>
            </tr>
            {/* Autosum row â€” column totals across all visible customers,
                pinned right below the header so the per-month grand totals
                stay visible while scrolling the row body. */}
            <tr className="bg-card/95 text-[11px] font-semibold border-b border-border">
              <Th sticky="left-0" className="w-10 text-muted" />
              <Th
                sticky="left-10"
                className="min-w-[220px] border-l border-border text-[10px] uppercase tracking-wide text-muted"
              >
                Î£ totals
              </Th>
              <Th className="min-w-[120px]" />
              <Th className="min-w-[120px]" />
              <Th className="w-[110px] text-center" />
              <Th className="text-right min-w-[140px] text-foreground">
                {fmtCurrency(projectionTotal)}
              </Th>
              {monthColumns.map((col, idx) => {
                if (col.kind === "actual") {
                  const i = col.monthIdx;
                  const actual = monthTotals[i];
                  const target = MONTHLY_TARGETS[i];
                  const onTrack = actual >= target;
                  const hasData = actual > 0;
                  const isCurrent = i === currentMonthIdx;
                  return (
                    <Th
                      key={`a-${i}-${idx}`}
                      className={cn(
                        "text-right min-w-[128px]",
                        isCurrent && "bg-primary-soft/40",
                      )}
                    >
                      <div
                        className={cn(
                          "tabular-nums",
                          hasData
                            ? onTrack
                              ? "text-success"
                              : "text-foreground"
                            : "text-muted-soft font-normal",
                        )}
                      >
                        {hasData ? fmtCurrencyShort(actual) : "â€”"}
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-muted">
                        tgt {fmtCurrencyShort(target)}
                      </div>
                    </Th>
                  );
                }
                // Forecast column sum
                const i = col.monthIdx;
                const fc = forecastTotals[i];
                const target = MONTHLY_TARGETS[i];
                const hasData = fc > 0;
                return (
                  <Th
                    key={`f-${i}-${idx}`}
                    className="text-right min-w-[128px] bg-warning-soft/60"
                  >
                    <div
                      className={cn(
                        "tabular-nums",
                        hasData ? "text-warning" : "text-muted-soft font-normal",
                      )}
                    >
                      {hasData ? fmtCurrencyShort(fc) : "â€”"}
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal text-muted">
                      tgt {fmtCurrencyShort(target)}
                    </div>
                  </Th>
                );
              })}
              <Th className="text-right min-w-[140px] bg-primary-soft/60 text-primary">
                {fmtCurrency(ytdGrand)}
              </Th>
              <Th className="text-right min-w-[160px] bg-primary-soft/60 text-primary">
                {fmtCurrency(projectionTotal - ytdGrand)}
              </Th>
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((r, idx) => (
              <Row
                key={r.id}
                row={r}
                striped={idx % 2 === 1}
                canEdit={canEdit}
                monthColumns={monthColumns}
                onPatch={patch => updateRow(r.id, patch)}
                onMonth={(i, v) => updateMonth(r.id, i, v)}
                onForecast={(i, v) => updateForecast(r.id, i, v)}
                onDelete={() => deleteRow(r.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <NewOrderForm
          open={orderFormOpen}
          onClose={() => setOrderFormOpen(false)}
          customers={Array.from(
            new Set(rows.map(r => r.customer).filter(Boolean)),
          ).sort()}
          onSubmit={onOrderSubmit}
        />
      )}
    </div>
  );
}

/* --------------------------------- Row --------------------------------- */

function Row({
  row,
  striped,
  canEdit,
  monthColumns,
  onPatch,
  onMonth,
  onForecast,
  onDelete,
}: {
  row: OrdersPortalRow;
  striped: boolean;
  canEdit: boolean;
  monthColumns: MonthCol[];
  onPatch: (patch: Partial<OrdersPortalRow>) => void;
  onMonth: (i: number, v: number | null) => void;
  onForecast: (i: number, v: number | null) => void;
  onDelete: () => void;
}) {
  const ytd = row.months.reduce<number>((s, v) => s + (v ?? 0), 0);
  const remaining = (row.projection || 0) - ytd;
  const overTarget = remaining < 0;
  const repTone = getRepColor(row.rep);
  const forecasts = row.forecasts ?? Array(12).fill(null);

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
        {canEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-muted-soft hover:text-danger transition-opacity p-1.5 rounded-md hover:bg-danger-soft"
            title="Delete row"
            aria-label={`Delete ${row.customer || "row"}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </Td>

      <Td sticky="left-10" striped={striped} className="border-l border-border">
        <TextCell
          value={row.customer}
          onChange={v => onPatch({ customer: v })}
          placeholder="Customer name"
          bold
          disabled={!canEdit}
        />
      </Td>

      <Td striped={striped}>
        <RepCell value={row.rep} onChange={v => onPatch({ rep: v })} disabled={!canEdit} />
      </Td>

      <Td striped={striped}>
        <SuggestCell
          value={row.cs}
          options={CS_SUGGESTIONS}
          listId="dl-cs"
          onChange={v => onPatch({ cs: v })}
          placeholder="CS"
          disabled={!canEdit}
        />
      </Td>

      <Td striped={striped} className="text-center">
        <TierSelect
          value={row.tier}
          onChange={v => onPatch({ tier: v })}
          disabled={!canEdit}
        />
      </Td>

      <Td striped={striped} className="text-right">
        <NumberCell
          value={row.projection}
          onChange={v => onPatch({ projection: v ?? 0 })}
          disabled={!canEdit}
        />
      </Td>

      {monthColumns.map((col, idx) =>
        col.kind === "actual" ? (
          <Td
            key={`a-${col.monthIdx}-${idx}`}
            striped={striped}
            className="text-right"
          >
            <NumberCell
              value={row.months[col.monthIdx]}
              onChange={nv => onMonth(col.monthIdx, nv)}
              disabled={!canEdit}
            />
          </Td>
        ) : (
          <Td
            key={`f-${col.monthIdx}-${idx}`}
            striped={striped}
            className="text-right bg-warning-soft/30"
          >
            <NumberCell
              value={forecasts[col.monthIdx]}
              onChange={nv => onForecast(col.monthIdx, nv)}
              disabled={!canEdit}
            />
          </Td>
        ),
      )}

      <Td striped={striped} className="text-right bg-primary-soft/40 font-semibold text-foreground">
        {ytd === 0 ? <span className="text-muted-soft font-normal">â€”</span> : fmtCurrency(ytd)}
      </Td>
      <Td
        striped={striped}
        className={cn(
          "text-right bg-primary-soft/40 font-semibold",
          overTarget ? "text-success" : "text-foreground",
        )}
      >
        {row.projection === 0 && ytd === 0 ? (
          <span className="text-muted-soft font-normal">â€”</span>
        ) : (
          fmtCurrency(remaining)
        )}
      </Td>
    </tr>
  );
}


/* -------------------------------- Cells -------------------------------- */

function TextCell({
  value,
  onChange,
  placeholder,
  bold,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded-md px-2 py-1.5 -mx-2 -my-1.5",
        bold ? "font-semibold text-foreground" : "text-foreground",
        disabled && "cursor-default",
      )}
    />
  );
}

function NumberCell({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const display = value == null || value === 0 ? "" : fmtCurrency(value);

  if (disabled) {
    return (
      <span
        className={cn(
          "w-full text-right tabular-nums px-2 py-1.5 -mx-2 -my-1.5 rounded-md block",
          display ? "text-foreground" : "text-muted-soft",
        )}
      >
        {display || "â€”"}
      </span>
    );
  }

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
      {display || "â€”"}
    </button>
  );
}

/**
 * Tier pill â€” high-contrast, color-coded by tier so AA / A / B / C are
 * unmistakable at a glance. Visually a pill; functionally a real <select>
 * for keyboard support, layered transparently over the pill.
 *
 *   AA = solid green   (priority / strategic)
 *   A  = solid blue    (strong account)
 *   B  = amber/yellow  (developing)
 *   C  = solid red     (small / early)
 */
function TierSelect({
  value,
  onChange,
  disabled,
}: {
  value: Tier | "";
  onChange: (v: Tier | "") => void;
  disabled?: boolean;
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
        disabled && "opacity-90 cursor-default",
      )}
    >
      <span className="flex-1 text-center select-none">{value || "â€”"}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as Tier | "")}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
        aria-label="Tier"
      >
        <option value="">â€”</option>
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
 * Rep cell â€” combobox input that wears the rep's color as a soft chip
 * around the editable text. Supports adding new rep names while still
 * surfacing the canonical 5 as datalist suggestions.
 */
function RepCell({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
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
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        placeholder="Rep"
        className={cn(
          "flex-1 min-w-0 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded px-0.5",
          value
            ? known
              ? "font-semibold"
              : "text-foreground"
            : "text-muted-soft",
          disabled && "cursor-default",
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
  disabled,
}: {
  value: string;
  options: readonly string[];
  listId: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary/40 rounded-md px-2 py-1.5 -mx-2 -my-1.5",
          value ? "text-foreground" : "text-muted-soft",
          disabled && "cursor-default",
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
