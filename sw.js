const CACHE_NAME = "mahiflix-shell-v1";

function shellUrls() {
  return [
    new URL("./", self.registration.scope).href,
    new URL("./index.html", self.registration.scope).href,
    new URL("./m-logo-v2.svg", self.registration.scope).href,
    new URL("./manifest.webmanifest", self.registration.scope).href,
    new URL("./link-status.json", self.registration.scope).href
  ];
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(shellUrls().map(async url => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch (_) {
        // A single optional asset must not prevent the catalog shell from installing.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("mahiflix-shell-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(new URL("./", self.registration.scope).href, response.clone()).catch(() => {});
          cache.put(request.url, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request) ||
          await caches.match(new URL("./", self.registration.scope).href) ||
          await caches.match(new URL("./index.html", self.registration.scope).href);
        return cached || new Response("MahiFlix is offline. Open the site once while connected to cache the directory.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  if (shellUrls().includes(request.url)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (_) {
        return await caches.match(request) || Response.error();
      }
    })());
  }
});
