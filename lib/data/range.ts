import { parseDateISO, shiftYear, startOfDay, endOfDay } from "@/lib/utils";
import type { DateRange } from "./types";

export type ResolvedRange = DateRange & { presetId: string | null };

/**
 * Parse the dashboard's date range from searchParams. Falls back to year-to-date.
 * Accepts either a preset id or explicit from/to dates.
 */
export function resolveRange(params: {
  preset?: string | string[] | undefined;
  from?: string | string[] | undefined;
  to?: string | string[] | undefined;
}): ResolvedRange {
  const preset = single(params.preset);
  const from = parseDateISO(single(params.from));
  const to = parseDateISO(single(params.to));

  if (from && to) {
    return {
      from: startOfDay(from),
      to: endOfDay(to),
      label: "Custom range",
      presetId: null,
    };
  }

  switch (preset) {
    case "mtd": {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
        label: "Month to date",
        presetId: "mtd",
      };
    }
    case "30d": {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to, label: "Last 30 days", presetId: "30d" };
    }
    case "90d": {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 89);
      return { from, to, label: "Last 90 days", presetId: "90d" };
    }
    case "12m": {
      const to = new Date();
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      return { from, to, label: "Last 12 months", presetId: "12m" };
    }
    case "lastyear": {
      const y = new Date().getFullYear() - 1;
      return {
        from: new Date(y, 0, 1),
        to: new Date(y, 11, 31, 23, 59, 59, 999),
        label: "Last calendar year",
        presetId: "lastyear",
      };
    }
    case "ytd":
    default: {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: now,
        label: "Year to date",
        presetId: "ytd",
      };
    }
  }
}

/** Same calendar window, shifted back exactly one year — used for YoY compare. */
export function priorYearOf(range: ResolvedRange): { from: Date; to: Date } {
  return { from: shiftYear(range.from, -1), to: shiftYear(range.to, -1) };
}

export type CompareRange = {
  from: Date;
  to: Date;
  /** "Same Period Last Year", "Prior 30 Days", etc. — full label for chart legends. */
  label: string;
  /** "Last Year", "Prior 30 Days" — terse form for KPI hint text. */
  shortLabel: string;
};

/**
 * Pick an intuitive compare window for the active range. Trailing-N presets
 * compare against the same N immediately before; YTD/MTD compare against the
 * same window prior year/month for seasonality; calendar windows compare
 * against the same calendar window in the prior year.
 */
export function getCompareRange(range: ResolvedRange): CompareRange {
  switch (range.presetId) {
    case "ytd": {
      return {
        from: shiftYear(range.from, -1),
        to: shiftYear(range.to, -1),
        label: "Same Period Last Year",
        shortLabel: "Last Year",
      };
    }
    case "mtd": {
      const from = new Date(range.from);
      from.setMonth(from.getMonth() - 1);
      const to = new Date(range.to);
      to.setMonth(to.getMonth() - 1);
      return {
        from,
        to,
        label: "Same Period Last Month",
        shortLabel: "Last Month",
      };
    }
    case "lastyear": {
      return {
        from: shiftYear(range.from, -1),
        to: shiftYear(range.to, -1),
        label: `${range.from.getFullYear() - 1}`,
        shortLabel: `${range.from.getFullYear() - 1}`,
      };
    }
    // Trailing-N presets and custom: previous window of equal duration
    default: {
      const ms = range.to.getTime() - range.from.getTime();
      const to = new Date(range.from.getTime() - 1);
      const from = new Date(to.getTime() - ms);
      const days = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
      const label = phraseForDays(days, range.presetId);
      return { from, to, label, shortLabel: label };
    }
  }
}

function phraseForDays(days: number, presetId: string | null): string {
  if (presetId === "30d") return "Prior 30 Days";
  if (presetId === "90d") return "Prior 90 Days";
  if (presetId === "12m") return "Previous 12 Months";
  if (days <= 35) return `Prior ${days} Days`;
  if (days <= 100) return `Prior ${days} Days`;
  const months = Math.round(days / 30);
  if (months <= 14) return `Prior ${months} Months`;
  return "Prior Period";
}

function single(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
