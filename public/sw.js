// Koino Service Worker — minimal app-shell cache for PWA installability
// Caches the app shell for offline use, but does NOT cache:
// - authenticated API responses
// - private user data
// - admin endpoints

// v3: shell re-cached after the logo PNG shrank from 820KB to 34KB (launch
// perf) — bumping the name purges the v2 cache holding the old heavy logo.
// v2: navigation fallback can no longer serve the cached Home shell for
// non-root URLs (the "Articles & Knowledge click bounces to Home" fix).
// Bumping the name makes activate() purge every v1 cache immediately.
const CACHE_NAME = "koino-v3";
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

  // For navigation requests, try network first. The cached app shell is an
  // OFFLINE fallback for the app root ("/") ONLY — it must never be served
  // as the response for a DIFFERENT URL (e.g. /knowledge, /blog): the shell
  // renders the Home feed for signed-in users, so a flaky network made
  // "click Articles & Knowledge" land the member back on Home while the
  // URL bar still showed /knowledge. Non-root navigations get their exact
  // cached copy when one exists, else a real network error — never a
  // masquerading Home page.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        url.pathname === "/"
          ? caches.match("/")
          : caches.match(event.request).then((cached) => cached || Response.error())
      )
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
