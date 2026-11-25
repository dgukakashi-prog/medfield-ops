/* MedField Ops service worker
 * Cache only the public application shell. Never cache Supabase/API responses,
 * authenticated pages, or user-specific data.
 */
const CACHE_NAME = "medfield-ops-shell-v2";
const APP_SHELL = ["./index.html"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Do not skipWaiting here: the page offers an explicit "Reload to update" action.
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("medfield-ops-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only handle document navigation and the explicit app-shell file. All API,
  // database, RPC, and other dynamic requests always go directly to the network.
  const isNavigation = request.mode === "navigate";
  const isShellFile = url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  if (!isNavigation && !isShellFile) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") {
        const copy = response.clone();
        await cache.put("./index.html", copy);
      }
      return response;
    } catch (error) {
      const cached = await cache.match("./index.html");
      if (cached) return cached;
      return new Response("MedField Ops is unavailable offline. Reconnect and reload.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
