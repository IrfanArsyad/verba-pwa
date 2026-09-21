// __BUILD__ diganti ID build unik oleh Dockerfile, jadi cache lama selalu dibersihkan.
const CACHE_NAME = 'verba-ai-pwa-__BUILD__';
const IS_DEV = '__BUILD__' === 'dev' || self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './js/backend.js?v=__BUILD__',
  './js/app.js?v=__BUILD__',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install Event - Cache Static Assets
self.addEventListener('install', (event) => {
  if (IS_DEV) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.filter((name) => IS_DEV || name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Network First untuk file aplikasi sendiri, cache hanya
// dipakai saat offline. Request ke domain lain (API LLM, Kokoro, font, CDN)
// tidak disentuh sama sekali.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Mode Dev (localhost/127.0.0.1/__BUILD__=dev): Bypass cache sepenuhnya agar edit di editor langsung berlaku
  if (IS_DEV) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
