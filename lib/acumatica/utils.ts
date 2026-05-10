/**
 * OData query + Field<T> unwrap helpers.
 */

import type { Field } from "./types";

/** Unwrap `{ value: T | null }`. */
export function v<T>(f: Field<T> | undefined | null): T | null {
  return f?.value ?? null;
}

/** Unwrap `Field<T>` with a fallback. */
export function vOr<T>(f: Field<T> | undefined | null, fallback: T): T {
  return f?.value ?? fallback;
}

/** Pack a value back into Acumatica's `{ value }` envelope (for writes). */
export function pack<T>(value: T): Field<T> {
  return { value };
}

/** Quote a string literal for an OData filter. Single quotes are doubled. */
export function odataString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** Format a Date as `datetimeoffset'2026-01-01T00:00:00Z'` for OData. */
export function odataDate(d: Date): string {
  return `datetimeoffset'${d.toISOString()}'`;
}

/** Combine filter clauses with `and`, dropping empties. */
export function andFilter(...clauses: Array<string | undefined | null | false>): string | undefined {
  const parts = clauses.filter((c): c is string => Boolean(c));
  return parts.length ? parts.join(" and ") : undefined;
}

/** Build OData query string from a sparse param object. */
export function odataQuery(params: {
  filter?: string;
  select?: string[];
  expand?: string[];
  top?: number;
  skip?: number;
  orderby?: string;
  custom?: string[];
}): string {
  const sp = new URLSearchParams();
  if (params.filter) sp.set("$filter", params.filter);
  if (params.select?.length) sp.set("$select", params.select.join(","));
  if (params.expand?.length) sp.set("$expand", params.expand.join(","));
  if (params.top != null) sp.set("$top", String(params.top));
  if (params.skip != null) sp.set("$skip", String(params.skip));
  if (params.orderby) sp.set("$orderby", params.orderby);
  if (params.custom?.length) sp.set("$custom", params.custom.join(","));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/**
 * Acumatica returns dates as ISO strings in instance local time, often without
 * an offset. Treat as UTC unless a TZ is present, since the portal renders
 * dates in the user's locale anyway.
 */
export function parseAcumaticaDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  return isNaN(d.getTime()) ? null : d;
}
