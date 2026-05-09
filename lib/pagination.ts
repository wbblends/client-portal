/**
 * URL-driven pagination shared by every list view in the portal. Pages use
 * `parsePagination` against their `searchParams` to read the current page +
 * page size, then pass the result to `paginate` to slice the underlying data.
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

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

export function paginate<T>(items: readonly T[], state: PaginationState): PaginatedResult<T> {
  const { pageSize } = state;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, state.page), totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}
