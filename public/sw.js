// Microstore Service Worker
// Cache strategies: cache-first (static), network-first (pages), stale-while-revalidate (API)
// Version is replaced at build time by scripts/generate-sw.js

const VERSION = 'wgoSqXYUBKirygqQ4GX9Y';
const STATIC_CACHE = `microstore-static-${VERSION}`;
const PAGES_CACHE = `microstore-pages-${VERSION}`;
const API_CACHE = `microstore-api-${VERSION}`;

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// ---------------------------------------------------------------------------
// Install — pre-cache essential assets, then skipWaiting for immediate activation
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}`);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching essential assets');
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[SW] Pre-cache partial failure:', err.message);
        });
      })
      .then(() => {
        // skipWaiting() ensures the new SW activates immediately instead of
        // waiting for all tabs to close. Combined with clientsClaim() in
        // activate, this delivers updates to users without a manual refresh.
        console.log('[SW] skipWaiting — activating immediately');
        return self.skipWaiting();
      }),
  );
});

// ---------------------------------------------------------------------------
// Activate — clean old caches from previous versions, then claim all clients
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION}`);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            // Delete caches that don't match the current version
            if (!key.includes(VERSION)) {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => {
        // clientsClaim() takes control of all open pages immediately,
        // so the new SW serves responses without waiting for a navigation.
        console.log('[SW] clientsClaim — controlling all pages');
        return self.clients.claim();
      }),
  );
});

// ---------------------------------------------------------------------------
// Fetch — route by request type
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // --- Navigation requests (pages) — network-first, fallback to cache ---
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, '/offline'));
    return;
  }

  // --- Static assets (JS, CSS, fonts, images from _next) — cache-first ---
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|ico)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // --- API calls — stale-while-revalidate ---
  if (url.pathname.startsWith('/api/') || url.pathname.includes('solana')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // --- Default: network-first ---
  event.respondWith(networkFirst(request, PAGES_CACHE));
});

// ---------------------------------------------------------------------------
// Strategy: Cache-first (static assets)
// ---------------------------------------------------------------------------
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // If offline and not cached, return a minimal fallback
    return new Response('Offline — resource not available', { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Strategy: Network-first (pages), fallback to cache
// ---------------------------------------------------------------------------
async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // If no cached page, return the offline fallback
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }

    return new Response('You are offline and this page is not cached.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ---------------------------------------------------------------------------
// Strategy: Stale-while-revalidate (API)
// ---------------------------------------------------------------------------
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

// ---------------------------------------------------------------------------
// Message handler — allow the app to communicate with the SW
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    // Respond with the SW version so the client can detect mismatches
    if (event.ports?.[0]) {
      event.ports[0].postMessage({ type: 'VERSION', version: VERSION });
    }
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => {
        if (event.ports?.[0]) {
          event.ports[0].postMessage({ type: 'CLEAR_CACHES_DONE' });
        }
      });
  }
});
