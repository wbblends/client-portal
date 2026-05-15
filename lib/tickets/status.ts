/**
 * Shared ticket status logic — the single definition of "overdue", "parked",
 * and "days open" used by both the PM boards and the analytics page. Keeping
 * it here means the board's row colors and the analytics counts can't quietly
 * drift apart.
 *
 * Pure module: no server-only imports, so client components can import it
 * directly (same constraint as `registry.ts`).
 */
export type TicketColor = "red" | "white" | "gray" | null;

// Statuses that mean "waiting on someone else" — not actionable on our side.
const GRAY_STATUSES = new Set<string>([
  "awaiting fps",
  "customer",
  "customer signature",
  "documents gathered",
  "hold",
  "in process",
  "in r&d",
  "in requote",
  "info needed",
  "r&d final check",
  "waiting for label proof",
  "waiting on fps",
  "waiting on sfp",
]);

// Subset of parked statuses that are also exempt from the dashboard's
// late/overdue count. The general parked-vs-overdue rule (see
// `healthBreakdown`) keeps past-due parked tickets visible as overdue, but
// for these three the ball is genuinely in someone else's court for the rest
// of the workflow, so counting them as late on dashboards is just noise.
const LATE_EXEMPT_STATUSES = new Set<string>([
  "customer",
  "customer signature",
  "r&d final check",
]);

/**
 * Status text arrives free-form from the source spreadsheet — fold case and
 * collapse whitespace so casing/spacing drift still matches.
 */
export function normalizeStatus(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when a ticket's status is one of the "waiting on someone else" states. */
export function isParked(status: string): boolean {
  return GRAY_STATUSES.has(normalizeStatus(status));
}

/** True when a ticket's status should never count toward dashboard late
 *  counts, even if past due. */
export function isLateExempt(status: string): boolean {
  return LATE_EXEMPT_STATUSES.has(normalizeStatus(status));
}

/**
 * Parse a free-text ticket date (open or due) to a local-midnight Date. The
 * source spreadsheet sends M/D/YY (its usual format); the sync API also
 * documents ISO. Both are built in local time so a day-granularity comparison
 * doesn't drift a day across timezones. Returns null for blank/unparseable
 * values.
 */
export function parseTicketDate(s: string | null): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(trimmed);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    return new Date(year, month - 1, day);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const t = Date.parse(trimmed);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Local-midnight epoch ms for a date — strips the time so day comparisons
 *  and day-count math don't drift with the clock. */
function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** True when the due date is strictly before today. Due today is not overdue. */
export function isOverdue(dueDate: string | null): boolean {
  const due = parseTicketDate(dueDate);
  if (!due) return false;
  return startOfDayMs(due) < startOfDayMs(new Date());
}

/**
 * Dashboard-facing "late" check: past due AND not in one of the
 * `LATE_EXEMPT_STATUSES`. Use this for any "overdue / late" count on a
 * dashboard. For pure date math, use `isOverdue`.
 */
export function isLate(t: { status: string; dueDate: string | null }): boolean {
  if (isLateExempt(t.status)) return false;
  return isOverdue(t.dueDate);
}

/**
 * Whole days the ticket has been open (open date → today, never negative).
 * Returns null when the open date is blank or unparseable so callers can
 * exclude it from averages rather than skewing them with a zero.
 */
export function daysOpen(openDate: string | null): number | null {
  const open = parseTicketDate(openDate);
  if (!open) return null;
  const ms = startOfDayMs(new Date()) - startOfDayMs(open);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * The color a row shows when no manual override is set:
 *   • gray — status is one of the "parked / waiting on someone else" states
 *   • red  — past its due date
 * Gray wins over red: a parked ticket stays gray even when overdue, because
 * it isn't actionable on our side until the status changes.
 */
export function autoColor(t: { status: string; dueDate: string | null }): TicketColor {
  if (isParked(t.status)) return "gray";
  if (isOverdue(t.dueDate)) return "red";
  return null;
}

/** Manual swatch color wins; otherwise fall back to the automatic color. */
export function effectiveColor(
  t: { status: string; dueDate: string | null; color: TicketColor },
): TicketColor {
  return t.color ?? autoColor(t);
}
