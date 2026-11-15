/*
 * PeerVoice service worker
 * Caches the app shell (plus its CDN dependencies) so the UI installs and
 * opens offline. Calls, chat, and QR scanning still need a live network
 * only where they genuinely need one (signaling, ICE) — everything else
 * about the interface works without a connection.
 */

const CACHE_VERSION = 'peervoice-v3';
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

// Third-party scripts the app depends on. Cached on install when possible,
// but a miss here must never block installation of the rest of the shell.
const CDN_ASSETS = [
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://unpkg.com/qrcode@1.5.3/build/qrcode.js',
  'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL_ASSETS);
      await Promise.all(
        CDN_ASSETS.map(async (url) => {
          try {
            const resp = await fetch(url, { mode: 'cors' });
            if (resp && resp.ok) await cache.put(url, resp);
          } catch (err) {
            // Offline during install, or the CDN is unreachable — fine,
            // the browser will fetch it live next time there's a network.
          }
        })
      );
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
  const isCdnAsset = CDN_ASSETS.includes(request.url);

  if (isNavigation) {
    // Network-first for page loads, so a reconnect always gets the latest
    // shell when one is available, falling back to cache when offline.
    // Note: this intentionally serves fresh index.html (not a cached copy)
    // whenever possible, so a ?add=... link always reaches current code.
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

  if (isSameOrigin || isCdnAsset) {
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
  // STUN/ICE and signaling go straight to the network, untouched — they
  // must never be served from cache.
});
