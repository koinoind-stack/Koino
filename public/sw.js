// Koino Service Worker — minimal app-shell cache for PWA installability
// Caches the app shell for offline use, but does NOT cache:
// - authenticated API responses
// - private user data
// - admin endpoints

const CACHE_NAME = "koino-v1";
const APP_SHELL = [
  "/",
  "/koino-logo.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Never cache API calls (they may contain private data)
  if (url.pathname.startsWith("/api/")) return;

  // Never cache auth endpoints
  if (url.pathname.startsWith("/auth/")) return;

  // For navigation requests, try network first, fall back to cached shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // For static assets, try cache first, then network
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          // Cache successful responses for static assets
          if (response.ok && url.pathname.match(/\.(js|css|png|jpg|webp|svg|ico|woff2)$/)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
    )
  );
});
