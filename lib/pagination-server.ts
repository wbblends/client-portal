import { cookies } from "next/headers";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_COOKIE_PREFIX,
  PAGE_SIZE_OPTIONS,
} from "./pagination";

/**
 * Reads the user's persisted page-size preference for a given pagination
 * namespace. Falls back to the supplied default when the cookie is missing,
 * malformed, or set to a value outside the allowlist.
 *
 * Lives in its own file because `next/headers` is server-only and the rest
 * of `pagination.ts` is imported by the client `<Pagination>` component.
 */
export async function getPersistedPageSize(
  opts: {
    sizeParam?: string;
    fallback?: number;
    pageSizes?: readonly number[];
  } = {},
): Promise<number> {
  const {
    sizeParam = "pageSize",
    fallback = DEFAULT_PAGE_SIZE,
    pageSizes = PAGE_SIZE_OPTIONS,
  } = opts;
  const jar = await cookies();
  const raw = jar.get(`${PAGE_SIZE_COOKIE_PREFIX}${sizeParam}`)?.value;
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && pageSizes.includes(n) ? n : fallback;
}
