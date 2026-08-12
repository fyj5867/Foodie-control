// v2 — switched from cache-first to network-first so that every future
// update to app.bundle.js / index.html shows up immediately for anyone
// online, instead of silently serving a stale cached copy forever.
// Offline visitors still fall back to whatever was last cached.
const CACHE_NAME = "tang-qian-shao-v2";
const APP_SHELL = ["./", "./index.html", "./app.bundle.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept calls to AI provider APIs — always go straight to network.
  if (url.hostname.endsWith("anthropic.com") || url.hostname.endsWith("googleapis.com")) return;
  if (event.request.method !== "GET") return;

  // Network-first: always try to fetch the latest version when online, and
  // keep the cache updated as a side effect. Only fall back to the cache
  // when the network request fails (i.e. actually offline).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
