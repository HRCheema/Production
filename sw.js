const CACHE_NAME = 'haider-production-v8';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests — POST/PUT etc. should always go to network
  if (event.request.method !== 'GET') return;

  // Network-first for Firebase/API calls, cache-first for app shell
  const url = event.request.url;
  if (url.includes('firestore') || url.includes('firebaseio') || url.includes('googleapis')) {
    return; // let these go straight to network
  }
  // HTML pages: network-first, so updated tool pages (e.g. Outmaker) always load
  // the latest version; the cache is only the offline fallback.
  const isPage = event.request.mode === 'navigate' || url.split('?')[0].endsWith('.html');
  if (isPage) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline and not in cache — for page navigations (e.g. opening the
        // site at "/" instead of "/index.html"), fall back to the cached
        // app shell instead of showing the browser's default offline error.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return cached;
      });
    })
  );
});
