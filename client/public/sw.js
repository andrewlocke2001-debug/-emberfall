/**
 * Minimal offline-first service worker (P11.3). Precaches nothing up front;
 * caches each same-origin GET as it's fetched (stale-while-revalidate-ish), so
 * a second visit works offline and installs cleanly as a PWA. The authoritative
 * multiplayer server is always network-first via the WebSocket, which the SW
 * never touches — this only covers static app-shell assets.
 */
const CACHE = "emberfall-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
