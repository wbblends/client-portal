"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { OrdersPortalGrid } from "./orders-portal-grid";
import {
  MONTHLY_TARGETS,
  CURRENT_PO_YEAR,
  type OrdersPortalRow,
} from "@/lib/data/orders-portal";

type YearData = { year: number; rows: OrdersPortalRow[] };

/**
 * Year-tab shell around the Orders Portal grid. Each tab is one calendar
 * year's per-customer PO sheet. The current year carries forecast columns
 * and month-to-date cards; prior years render as a closed book of actuals.
 * Monthly targets exist for the current year only — prior years pass null.
 */
export function OrdersPortalYears({
  years,
  canEdit,
}: {
  years: YearData[];
  canEdit: boolean;
}) {
  const [selectedYear, setSelectedYear] = useState(CURRENT_PO_YEAR);
  const active =
    years.find(y => y.year === selectedYear) ?? years[years.length - 1];

  // Newest year first so the live year sits on the left of the tab strip.
  const tabs = [...years].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="PO year"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-accent/40 p-1"
      >
        {tabs.map(t => {
          const selected = t.year === active.year;
          return (
            <button
              key={t.year}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedYear(t.year)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors",
                selected
                  ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted hover:text-foreground",
              )}
            >
              {t.year}
              {t.year === CURRENT_PO_YEAR && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    selected
                      ? "bg-primary-soft text-primary"
                      : "text-muted-soft",
                  )}
                >
                  current
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Remount on year change so the grid's row state + poll loop reset. */}
      <OrdersPortalGrid
        key={active.year}
        year={active.year}
        initialRows={active.rows}
        canEdit={canEdit}
        targets={active.year === CURRENT_PO_YEAR ? MONTHLY_TARGETS : null}
      />
    </div>
  );
}
