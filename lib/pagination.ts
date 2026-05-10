/**
 * URL-driven pagination shared by every list view in the portal. Pages use
 * `parsePagination` against their `searchParams` to read the current page +
 * page size, then forward `{ offset, limit }` to the data loader, which
 * returns a `Page<T>` slice.
 *
 * Sizes are restricted to the `pageSizes` allowlist so URL tampering can't
 * coerce a server into materializing thousands of rows.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Cookie name prefix used to persist a user's preferred page size per
 * pagination namespace (e.g. `wbb_pgsize_pageSize`, `wbb_pgsize_ooSize`).
 * The client writes via `document.cookie`; the server reads it through
 * `getPersistedPageSize` in `pagination-server.ts`.
 */
export const PAGE_SIZE_COOKIE_PREFIX = "wbb_pgsize_";

export type PaginationState = {
  page: number;
  pageSize: number;
};

/** Slice descriptor passed from a page's pagination state to a data loader. */
export type PageOpts = {
  offset?: number;
  limit?: number;
};

/** Standard shape every paginated loader returns. */
export type Page<T> = {
  items: T[];
  total: number;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parsePagination(
  searchParams: RawSearchParams,
  opts: {
    pageParam?: string;
    sizeParam?: string;
    defaultPageSize?: number;
    pageSizes?: readonly number[];
  } = {},
): PaginationState {
  const {
    pageParam = "page",
    sizeParam = "pageSize",
    defaultPageSize = DEFAULT_PAGE_SIZE,
    pageSizes = PAGE_SIZE_OPTIONS,
  } = opts;

  const rawPage = Number.parseInt(firstValue(searchParams[pageParam]) ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawSize = Number.parseInt(firstValue(searchParams[sizeParam]) ?? "", 10);
  const pageSize =
    Number.isFinite(rawSize) && pageSizes.includes(rawSize) ? rawSize : defaultPageSize;

  return { page, pageSize };
}

/** Translate a UI-facing pagination state into the loader's offset/limit. */
export function toPageOpts(state: PaginationState): Required<PageOpts> {
  return {
    offset: Math.max(0, (state.page - 1) * state.pageSize),
    limit: state.pageSize,
  };
}

/**
 * In-memory slicer used by mock data loaders. Real-API loaders should
 * replace this with the server's native paging (e.g. Acumatica `$top`/`$skip`)
 * and report the unfiltered total alongside the slice.
 *
 * When called with no opts, returns the full list — useful for callers that
 * still need every row (charts, aggregates) without changing the loader's
 * return shape.
 */
export function applyPage<T>(items: readonly T[], opts: PageOpts = {}): Page<T> {
  const total = items.length;
  if (opts.offset == null && opts.limit == null) {
    return { items: items.slice(), total };
  }
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = opts.limit ?? Math.max(0, total - offset);
  return { items: items.slice(offset, offset + limit), total };
}

