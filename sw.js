const CACHE_NAME = "streamcloud-shell-v14";

// Keep the existing offline shell and cache the two category/motion modules as part of it.
const SHELL_PATHS = [
  "./", "./index.html", "./s-logo-v1.svg", "./manifest.webmanifest", "./link-status.json",
  "./logo-manifest.js",
  "./titles.css", "./titles.js", "./listings-config.js", "./admin-listings.js", "./premium.css", "./polish.css", "./data/recommendations.json",
  "./cinema/cinema.css",
  "./cinema/portal.css",
  "./cinema/premium.css",
  "./cinema/categories.js",
  "./cinema/main.js",
  "./cinema/state.js",
  "./cinema/choreography.js",
  "./cinema/interactions.js",
  "./cinema/preloader.js",
  "./cinema/scene.js",
  "./vendor/three.module.min.js",
  "./assets/logos/1tube.svg",
  "./assets/logos/site-1tube.webp",
  "./assets/logos/site-bcine.webp",
  "./assets/logos/site-bingr.webp",
  "./assets/logos/site-cinegram.webp",
  "./assets/logos/site-cinehd.webp",
  "./assets/logos/site-cinejoy.webp",
  "./assets/logos/site-m4uhd.webp",
  "./assets/logos/site-nightflix-to.webp",
  "./assets/logos/site-nightflix-vg.webp",
  "./assets/logos/site-plex.webp",
  "./assets/logos/site-pvrplay.webp",
  "./assets/logos/site-7reel.webp",
  "./assets/logos/site-watchott.webp",
  "./assets/logos/7movies.svg",
  "./assets/logos/7reel.svg",
  "./assets/logos/anivortex.svg",
  "./assets/logos/bingr.svg",
  "./assets/logos/cinegram.svg",
  "./assets/logos/cinehd.svg",
  "./assets/logos/cinejoy.svg",
  "./assets/logos/filmtv.svg",
  "./assets/logos/freekz.svg",
  "./assets/logos/hdghartv.svg",
  "./assets/logos/m4uhd.svg",
  "./assets/logos/moviboxapk.svg",
  "./assets/logos/netmirror.svg",
  "./assets/logos/nightflix.svg",
  "./assets/logos/nuvix.svg",
  "./assets/logos/nxsha.svg",
  "./assets/logos/pvrplay.svg",
  "./assets/logos/vega.svg",
  "./assets/logos/watchott.svg"
];

function shellUrls() {
  return SHELL_PATHS.map(path => new URL(path, self.registration.scope).href);
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
    await Promise.all(keys.filter(key =>
      (key.startsWith("streamcloud-shell-") || key.startsWith("mahiflix-shell-")) && key !== CACHE_NAME
    ).map(key => caches.delete(key)));
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
        return cached || new Response("StreamCloud is offline. Open the site once while connected to cache the directory.", {
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
