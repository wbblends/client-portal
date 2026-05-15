/**
 * Shared HubSpot CRM Search API throttle.
 *
 * HubSpot's search API enforces a tight per-second limit (4 req/sec on
 * Free/Starter, 5 on Pro). Both `hubspot.ts` and `pipeline-history.ts` issue
 * search calls; without a shared queue they each throttle independently and
 * still trip the global account-level limit when both run concurrently.
 *
 * `searchFetch` is a process-wide serialized queue: only one search call is
 * in flight at a time, with SEARCH_GAP_MS between releases. Module-level state
 * means one queue across every render in this Node process — exactly what we
 * want, since HubSpot's limit is account-wide and doesn't care which call site
 * issued the request.
 */

const HUBSPOT_TIMEOUT_MS = 12_000;
const SEARCH_GAP_MS = 280;

let searchQueueTail: Promise<void> = Promise.resolve();

export function timedFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HUBSPOT_TIMEOUT_MS) });
}

export async function searchFetch(url: string, init: RequestInit): Promise<Response> {
  const prevTail = searchQueueTail;
  let release: () => void = () => {};
  searchQueueTail = new Promise<void>(r => {
    release = r;
  });

  try {
    await prevTail;
    let res = await timedFetch(url, init);
    if (res.status === 429) {
      // Honor Retry-After if present (HubSpot returns it for SECONDLY limits).
      const retryAfter = Number(res.headers.get("retry-after") ?? 1);
      const waitMs = Math.max(1000, retryAfter * 1000);
      await new Promise(r => setTimeout(r, waitMs));
      res = await timedFetch(url, init);
    }
    return res;
  } finally {
    setTimeout(release, SEARCH_GAP_MS);
  }
}
