/**
 * Server-side helpers for parsing list-page filter/sort params from
 * `searchParams`. Pages stay as server components — they read the URL,
 * narrow the dataset, and hand a pre-filtered list to display components.
 *
 * Multi-select filter values are comma-joined in the URL
 * (e.g. `?status=overdue,open`). Sort values are stored as `field-dir`
 * tokens (e.g. `?sort=date-desc`) so a single URL parameter captures both
 * dimensions and the dropdown UI binds to one value.
 */

type RawParam = string | string[] | undefined;

export function parseSearchParam(v: RawParam): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function parseMultiParam(v: RawParam): string[] {
  const single = Array.isArray(v) ? v[0] : v;
  if (!single) return [];
  return single.split(",").map(s => s.trim()).filter(Boolean);
}

/** Generic includes-any check used for multi-select filter narrowing. */
export function matchesAny<T extends string>(value: T, selected: string[]): boolean {
  return selected.length === 0 || selected.includes(value);
}

/**
 * Build a comparator from a sort token like "date-desc". Resolver returns
 * the sortable value (string | number | Date) for a given row + field id.
 */
export function compareBy<T>(
  sortToken: string,
  resolver: (row: T, field: string) => string | number | Date | null | undefined,
): (a: T, b: T) => number {
  const [field, dirRaw] = sortToken.split("-");
  const dir = dirRaw === "asc" ? 1 : -1;
  return (a, b) => {
    const av = resolver(a, field);
    const bv = resolver(b, field);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;  // nulls sort last regardless of direction
    if (bv == null) return -1;
    const ax = av instanceof Date ? av.getTime() : av;
    const bx = bv instanceof Date ? bv.getTime() : bv;
    if (typeof ax === "number" && typeof bx === "number") {
      return (ax - bx) * dir;
    }
    return String(ax).localeCompare(String(bx)) * dir;
  };
}
