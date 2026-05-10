/**
 * Low-level Acumatica HTTP client.
 *
 * - Bearer auth via `getAccessToken()`; transparent re-auth on 401.
 * - Retry on 429 (throttling) and 5xx with exponential backoff + jitter.
 * - Auto-paginates `getList` until the server returns fewer than `pageSize`.
 * - Normalizes errors to `AcumaticaApiError` with a coarse `code`.
 *
 * Acumatica gotchas baked in here:
 *   - No server-side `nextLink`; pagination is `$top` + `$skip` driven.
 *   - HTTP 511 = response too large; halve `$top` and retry once.
 *   - 401 + token cache invalidation, then a single retry.
 */

import { getAcumaticaConfig } from "./config";
import { getAccessToken, invalidateToken } from "./auth";
import { AcumaticaApiError, type ErrorCode } from "./types";

type Json = Record<string, unknown>;

type RequestOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** When true, return the raw Response (for binary downloads). */
  raw?: boolean;
  signal?: AbortSignal;
};

const MAX_RETRIES = 3;

export async function request<T = unknown>(url: string, opts: RequestOpts = {}): Promise<T> {
  const cfg = getAcumaticaConfig();
  const method = opts.method ?? "GET";
  let attempt = 0;
  let didReauth = false;
  let lastErr: AcumaticaApiError | null = null;

  while (attempt <= MAX_RETRIES) {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    };
    if (opts.body !== undefined && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const ctl = new AbortController();
    if (opts.signal) opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
    const timer = setTimeout(() => ctl.abort(), cfg.requestTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body),
        signal: ctl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      lastErr = new AcumaticaApiError({
        status: 0,
        code: "network",
        message: err instanceof Error ? err.message : String(err),
      });
      if (attempt < MAX_RETRIES) {
        await sleep(backoff(attempt));
        attempt++;
        continue;
      }
      throw lastErr;
    }
    clearTimeout(timer);

    if (res.ok) {
      if (opts.raw) return res as unknown as T;
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }

    if (res.status === 401 && !didReauth) {
      invalidateToken();
      didReauth = true;
      continue;
    }

    if (shouldRetry(res.status) && attempt < MAX_RETRIES) {
      const wait = res.status === 429
        ? Math.max(parseRetryAfter(res), backoff(attempt))
        : backoff(attempt);
      await sleep(wait);
      attempt++;
      continue;
    }

    throw await toApiError(res);
  }

  throw lastErr ?? new AcumaticaApiError({
    status: 0,
    code: "network",
    message: "Request failed after retries",
  });
}

/**
 * Auto-paginating list fetch. Caller passes the entity URL **without**
 * `$top`/`$skip`; we add them. Returns all rows accumulated.
 */
export async function getList<T>(url: string, opts: { pageSize?: number; signal?: AbortSignal } = {}): Promise<T[]> {
  const cfg = getAcumaticaConfig();
  let pageSize = Math.min(opts.pageSize ?? cfg.maxPageSize, cfg.maxPageSize);
  const all: T[] = [];
  let skip = 0;
  const sep = url.includes("?") ? "&" : "?";

  while (true) {
    const pageUrl = `${url}${sep}$top=${pageSize}&$skip=${skip}`;
    let page: T[];
    try {
      page = await request<T[]>(pageUrl, { signal: opts.signal });
    } catch (err) {
      // 511 = response too large. Halve page size and retry the same skip.
      if (err instanceof AcumaticaApiError && err.code === "size" && pageSize > 25) {
        pageSize = Math.floor(pageSize / 2);
        continue;
      }
      throw err;
    }
    all.push(...page);
    if (page.length < pageSize) return all;
    skip += pageSize;
  }
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status !== 501);
}

function parseRetryAfter(res: Response): number {
  const h = res.headers.get("retry-after");
  if (!h) return 1000;
  const n = Number(h);
  if (Number.isFinite(n)) return n * 1000;
  const d = Date.parse(h);
  return Number.isFinite(d) ? Math.max(0, d - Date.now()) : 1000;
}

function backoff(attempt: number): number {
  const base = 250 * 2 ** attempt;
  return base + Math.random() * base;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function toApiError(res: Response): Promise<AcumaticaApiError> {
  let body: Json | string = "";
  try {
    body = (await res.json()) as Json;
  } catch {
    try { body = await res.text(); } catch { /* noop */ }
  }
  const message = typeof body === "object" && body
    ? String(body.exceptionMessage ?? body.message ?? res.statusText)
    : (body || res.statusText);
  const exceptionType = typeof body === "object" && body && typeof body.exceptionType === "string"
    ? body.exceptionType
    : undefined;
  return new AcumaticaApiError({
    status: res.status,
    code: classify(res.status),
    message,
    exceptionType,
  });
}

function classify(status: number): ErrorCode {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 422) return "validation";
  if (status === 429) return "rate_limit";
  if (status === 511) return "size";
  if (status >= 500) return "server";
  return "server";
}
