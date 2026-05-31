// Hush — service worker.
// Network-first for the HTML so updated versions land as soon as the device is
// online (cache is only an offline fallback). Other assets stay cache-first.
// Bump CACHE_NAME by one whenever index.html or any cached file changes.
const CACHE_NAME = 'hush-v28';

// Core files to pre-cache for offline. Relative paths only (served from a
// GitHub Pages sub-path).
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  // Activate this worker as soon as it has finished installing.
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Is this a request for the page/HTML? (navigations, or anything that
  // accepts text/html). These go network-first so the newest build wins.
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          // Got the latest from the network — refresh the cached copy.
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
          return res;
        })
        .catch(function () {
          // Offline — fall back to the cached page.
          return caches.match(req).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Everything else (icons, manifest): cache-first.
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req);
    })
  );
});
