/* WB Blends portal — minimal service worker.
 *
 * Conservative on purpose: we do NOT cache HTML or API responses (those
 * change every session and we don't want to serve stale customer data).
 * We DO cache static assets (Next chunks, fonts, images) with a
 * stale-while-revalidate strategy so navigation stays fast offline and
 * the install prompt is allowed to appear.
 *
 * Bumping CACHE_VERSION invalidates all caches on next activation.
 */

const CACHE_VERSION = "wbb-v1";
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache only buildable static assets. Avoid HTML (so customer-data pages
  // never go stale) and API routes (always live).
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then(res => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })(),
  );
});
