"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Plus, Trash2, ChevronDown, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ACTUALS_2025,
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
import { MonthlyPosReceivedChart } from "@/components/dashboard/orders-received-chart";
import type { MonthlyPosReceivedPoint } from "@/components/dashboard/orders-received-chart-impl";

type MonthCol =
  | { kind: "actual"; monthIdx: number }
  | { kind: "forecast"; monthIdx: number };

/**
 * Editable, spreadsheet-style grid mirroring the "2026 POs" tab. Rows live in
 * the `orders_portal_rows` table — any admin's edit becomes visible to every
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
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * Track which row.field combinations have a pending local edit. While a
   * cell is "dirty" (mid-typing) the poll loop won't clobber it with the
   * server's older value. Cleared when the PATCH for that row resolves.
   */
  const dirtyRef = useRef<Set<string>>(new Set());

  // ── Polling: every 10s pick up edits from other users. We pause polling
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
        // ignore — next tick will retry
      }
    };
    const id = setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // ── Mutations through the API. All write helpers patch local state
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
          setSyncError(data.error ?? "Save failed — your edit hasn't been shared yet.");
        } else {
          setSyncError(null);
        }
      } catch {
        setSyncError("Network error — your edit hasn't been shared yet.");
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
      setSyncError("Network error — couldn't add a row.");
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
      setSyncError("Network error — couldn't delete that row.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  /**
   * When the new-order form submits, hand the order to the server which
   * folds it into the appropriate row (creating a customer row if needed).
   * The response carries the canonical row so we can update local state in
   * one shot — no double-write.
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
        setSyncError(data.error ?? "Order didn't sync — try again.");
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
      setSyncError("Network error — order didn't sync.");
    } finally {
      pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    }
  };

  // ── Aggregates
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

  /**
   * Points feeding the Monthly POs Received chart below: 2025 actuals
   * (hardcoded) followed by 2026 actuals to date, paired with each month's
   * 2026 target. We trim 2026 to the last month with any booked revenue so
   * future months don't render as zero bars.
   */
  const posReceivedPoints = useMemo<MonthlyPosReceivedPoint[]>(() => {
    let lastWithData = -1;
    for (let i = 11; i >= 0; i--) {
      if (monthTotals[i] > 0) {
        lastWithData = i;
        break;
      }
    }
    const actuals2026 = lastWithData === -1 ? [] : monthTotals.slice(0, lastWithData + 1);
    return [
      ...ACTUALS_2025.map(({ month, value }) => ({
        label: `${month}-25`,
        actual: value,
        target: null,
        isYear2026: false,
      })),
      ...actuals2026.map((value, i) => ({
        label: `${MONTH_SHORT[i]}-26`,
        actual: value,
        target: MONTHLY_TARGETS[i],
        isYear2026: true,
      })),
    ];
  }, [monthTotals]);

  // Today's month — drives the "Orders this month" / "Orders target" pair and
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

  const quarters = useMemo(
    () => [
      { label: "Q1", actual: monthTotals[0] + monthTotals[1] + monthTotals[2], target: MONTHLY_TARGETS[0] + MONTHLY_TARGETS[1] + MONTHLY_TARGETS[2] },
      { label: "Q2", actual: monthTotals[3] + monthTotals[4] + monthTotals[5], target: MONTHLY_TARGETS[3] + MONTHLY_TARGETS[4] + MONTHLY_TARGETS[5] },
      { label: "Q3", actual: monthTotals[6] + monthTotals[7] + monthTotals[8], target: MONTHLY_TARGETS[6] + MONTHLY_TARGETS[7] + MONTHLY_TARGETS[8] },
      { label: "Q4", actual: monthTotals[9] + monthTotals[10] + monthTotals[11], target: MONTHLY_TARGETS[9] + MONTHLY_TARGETS[10] + MONTHLY_TARGETS[11] },
    ],
    [monthTotals],
  );

  /**
   * Aggregate YTD (sum of all 12 months) and MTD (current month only) by rep
   * and by tier. Rep order follows REP_SUGGESTIONS so the canonical 5 stay
   * stacked in their usual sequence; any extra reps fall in after them
   * alphabetically. Tier order follows TIERS (AA → A → B → C); rows with no
   * tier set are grouped under "—" at the bottom.
   */
  const repBreakdown = useMemo(() => {
    const map = new Map<string, { ytd: number; mtd: number }>();
    for (const r of rows) {
      const k = r.rep || "—";
      const bucket = map.get(k) ?? { ytd: 0, mtd: 0 };
      for (let i = 0; i < 12; i++) bucket.ytd += r.months[i] ?? 0;
      bucket.mtd += r.months[currentMonthIdx] ?? 0;
      map.set(k, bucket);
    }
    const order = [...REP_SUGGESTIONS];
    const seen = new Set<string>(order);
    for (const k of Array.from(map.keys()).sort()) {
      if (!seen.has(k)) {
        order.push(k);
        seen.add(k);
      }
    }
    return order.filter(k => map.has(k)).map(rep => ({ rep, ...map.get(rep)! }));
  }, [rows, currentMonthIdx]);

  const tierBreakdown = useMemo(() => {
    const map = new Map<string, { ytd: number; mtd: number }>();
    for (const r of rows) {
      const k = r.tier || "—";
      const bucket = map.get(k) ?? { ytd: 0, mtd: 0 };
      for (let i = 0; i < 12; i++) bucket.ytd += r.months[i] ?? 0;
      bucket.mtd += r.months[currentMonthIdx] ?? 0;
      map.set(k, bucket);
    }
    const order: string[] = [...TIERS, "—"];
    return order.filter(k => map.has(k)).map(tier => ({ tier, ...map.get(tier)! }));
  }, [rows, currentMonthIdx]);

  return (
    <div className="space-y-6">
      {/* ── Current-month focus card ──────────────────────────────────── */}
      {/* Full-width card styled like the Quarter cards below: short label +
          delta chip on top, big actual number, "of $target (pct%)" sub line,
          and a progress bar at the bottom. */}
      {/* Current-month booked + 90-day forecast row. Four cards: the current
          month's actual progress vs target, followed by forecast totals for
          this month plus the next two. Forecast cards share the yellow
          palette used by the forecast columns in the spreadsheet below. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const delta = monthActual - monthTarget;
          const onTrack = delta >= 0;
          return (
            <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {currentMonthLabel} Orders Actuals
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
              <div className="mt-2 font-display text-[28px] tabular-nums leading-tight text-foreground">
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
        {forecastWindow.map(i => {
          const fc = forecastTotals[i];
          const target = MONTHLY_TARGETS[i];
          const delta = fc - target;
          const onTrack = delta >= 0;
          const progress = target > 0 ? fc / target : 0;
          return (
            <div
              key={`forecast-card-${i}`}
              className="rounded-xl border border-warning-soft bg-warning-soft/40 p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide text-warning">
                  {MONTH_LABELS[i]} Orders Forecast
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
              <div className="mt-2 font-display text-[28px] tabular-nums leading-tight text-foreground">
                {fmtCurrency(fc)}
              </div>
              <div className="mt-0.5 text-sm text-muted">
                of {fmtCurrency(target)} ({pct(fc, target)})
              </div>
              <div className="mt-4 h-2 w-full rounded-full bg-accent overflow-hidden">
                <div
                  className={cn("h-full rounded-full", onTrack ? "bg-success" : "bg-warning")}
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Quarter cards ──────────────────────────────────────────────── */}
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
                <div className="text-xs font-bold uppercase tracking-wide text-muted">
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
              <div className="mt-2 font-display text-[22px] tabular-nums text-foreground">
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

      {/* ── Monthly POs Received (below the Quarters) ─────────────────── */}
      <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <header className="px-5 pt-4 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">Monthly POs Received</h2>
        </header>
        <div className="px-3 pb-4">
          <MonthlyPosReceivedChart points={posReceivedPoints} />
        </div>
      </section>

      {/* ── Breakdowns: by Rep / by Tier ──────────────────────────────── */}
      {/* Side-by-side panels showing YTD and current-month booked revenue
          aggregated by rep and tier. Percent column is each row's share of
          its column total, so the columns read as a horizontal stack. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownPanel
          title="By Rep"
          monthLabel={MONTH_SHORT[currentMonthIdx]}
          totalYtd={ytdGrand}
          totalMtd={monthActual}
          rows={repBreakdown.map(b => ({
            key: b.rep,
            label: b.rep || "—",
            dotClass: getRepColor(b.rep).dot,
            ytd: b.ytd,
            mtd: b.mtd,
          }))}
          firstColHeader="Rep"
        />
        <BreakdownPanel
          title="By Tier"
          monthLabel={MONTH_SHORT[currentMonthIdx]}
          totalYtd={ytdGrand}
          totalMtd={monthActual}
          rows={tierBreakdown.map(b => ({
            key: b.tier,
            label: b.tier || "—",
            dotClass: tierDotClass(b.tier),
            ytd: b.ytd,
            mtd: b.mtd,
          }))}
          firstColHeader="Tier"
        />
      </div>

      {/* ── Spreadsheet ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full border-separate border-spacing-0 text-[13px] tabular-nums">
          <thead>
            <tr className="bg-accent/40 text-[11px] font-bold uppercase tracking-wide text-muted">
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
                    <div className="leading-tight">
                      <div>{MONTH_SHORT[col.monthIdx]}</div>
                      <div className="text-[9px] font-medium normal-case tracking-normal opacity-80">
                        forecast
                      </div>
                    </div>
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
            {/* Autosum row — column totals across all visible customers,
                pinned right below the header so the per-month grand totals
                stay visible while scrolling the row body. */}
            <tr className="bg-card/95 text-[11px] font-semibold border-b border-border">
              <Th sticky="left-0" className="w-10 text-muted" />
              <Th
                sticky="left-10"
                className="min-w-[220px] border-l border-border text-[10px] font-bold uppercase tracking-wide text-muted"
              >
                Σ totals
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
                        {hasData ? fmtCurrencyShort(actual) : "—"}
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
                      {hasData ? fmtCurrencyShort(fc) : "—"}
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
            {rows.map((r, idx) => (
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
            {canEdit && (
              <tr className="bg-card">
                <td
                  colSpan={8 + monthColumns.length}
                  className="px-3 py-2.5 border-t border-border/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={addRow}
                        className="inline-flex items-center gap-1 text-[12px] text-muted-soft hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Add row
                      </button>
                      {syncError && (
                        <span className="text-xs text-danger font-medium" role="status">
                          {syncError}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setOrderFormOpen(true)}
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      Enter new order
                    </Button>
                  </div>
                </td>
              </tr>
            )}
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
        {display || "—"}
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
      {display || "—"}
    </button>
  );
}

/**
 * Tier pill — high-contrast, color-coded by tier so AA / A / B / C are
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
      <span className="flex-1 text-center select-none">{value || "—"}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value as Tier | "")}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
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
        sticky && `sticky ${sticky} z-20 bg-accent`,
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

/**
 * Two-column ($ + % of total) breakdown for a single dimension. Used twice
 * on the dashboard: by Rep, by Tier. The bar in the % column visually echoes
 * each row's share so the eye can rank dominant buckets without doing math.
 */
function BreakdownPanel({
  title,
  monthLabel,
  firstColHeader,
  rows,
  totalYtd,
  totalMtd,
}: {
  title: string;
  monthLabel: string;
  firstColHeader: string;
  rows: { key: string; label: string; dotClass: string; ytd: number; mtd: number }[];
  totalYtd: number;
  totalMtd: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="px-5 pt-4 pb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
        <span className="text-[11px] uppercase tracking-wide text-muted">
          YTD · MTD {monthLabel}
        </span>
      </header>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="bg-accent/40 text-[10px] font-bold uppercase tracking-wide text-muted">
            <th className="px-5 py-2 text-left">{firstColHeader}</th>
            <th className="px-3 py-2 text-right">YTD</th>
            <th className="px-3 py-2 text-right w-[22%]">% of YTD</th>
            <th className="px-3 py-2 text-right">MTD ({monthLabel})</th>
            <th className="pl-3 pr-5 py-2 text-right w-[22%]">% of MTD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const ytdPct = totalYtd > 0 ? r.ytd / totalYtd : 0;
            const mtdPct = totalMtd > 0 ? r.mtd / totalMtd : 0;
            return (
              <tr key={r.key} className="border-t border-border/50">
                <td className="px-5 py-2">
                  <span className="inline-flex items-center gap-2 text-foreground font-medium">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", r.dotClass)} />
                    {r.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {r.ytd === 0 ? <span className="text-muted-soft">—</span> : fmtCurrency(r.ytd)}
                </td>
                <td className="px-3 py-2 text-right">
                  <PctBar value={ytdPct} dotClass={r.dotClass} />
                </td>
                <td className="px-3 py-2 text-right text-foreground">
                  {r.mtd === 0 ? <span className="text-muted-soft">—</span> : fmtCurrency(r.mtd)}
                </td>
                <td className="pl-3 pr-5 py-2 text-right">
                  <PctBar value={mtdPct} dotClass={r.dotClass} />
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-border bg-accent/25 font-semibold text-foreground">
            <td className="px-5 py-2.5">Total</td>
            <td className="px-3 py-2.5 text-right">{fmtCurrency(totalYtd)}</td>
            <td className="px-3 py-2.5 text-right text-muted text-[12px]">100%</td>
            <td className="px-3 py-2.5 text-right">{fmtCurrency(totalMtd)}</td>
            <td className="pl-3 pr-5 py-2.5 text-right text-muted text-[12px]">100%</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function PctBar({ value, dotClass }: { value: number; dotClass: string }) {
  return (
    <span className="inline-flex items-center gap-2 justify-end w-full">
      <span className="text-[12px] text-muted tabular-nums w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
      <span className="h-1.5 w-14 rounded-full bg-accent overflow-hidden shrink-0">
        <span
          className={cn("block h-full rounded-full", dotClass)}
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </span>
    </span>
  );
}

function tierDotClass(tier: string) {
  switch (tier) {
    case "AA":
      return "bg-emerald-600";
    case "A":
      return "bg-blue-600";
    case "B":
      return "bg-amber-400";
    case "C":
      return "bg-rose-600";
    default:
      return "bg-muted-soft";
  }
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

