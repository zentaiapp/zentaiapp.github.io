/*
 * PeerVoice service worker
 * Caches the app shell so the UI installs and opens offline.
 * Calls themselves still need a live network (for signaling + ICE),
 * but the interface itself will never show a blank screen.
 */

const CACHE_VERSION = 'peervoice-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './logo.svg',
  './icon-192.png',
  './icon-512.png'
];

// Third-party script the app depends on. Cached on install when possible,
// but a miss here must never block installation of the rest of the shell.
const PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);
      try {
        const resp = await fetch(PEERJS_CDN, { mode: 'cors' });
        if (resp && resp.ok) await cache.put(PEERJS_CDN, resp);
      } catch (err) {
        // Offline during install, or the CDN is unreachable — fine,
        // app.js will fall back to a live fetch next time there's a network.
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('peervoice-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isSameOrigin = url.origin === self.location.origin;
  const isPeerJsCdn = request.url === PEERJS_CDN;

  if (isNavigation) {
    // Network-first for page loads, so a reconnect always gets the latest
    // shell when one is available, falling back to cache when offline.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  if (isSameOrigin || isPeerJsCdn) {
    // Cache-first for the app shell and its one external dependency.
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch (err) {
          return cached || Response.error();
        }
      })()
    );
  }
  // Everything else (STUN/ICE, signaling, media) goes straight to the
  // network untouched — it must never be served from cache.
});
