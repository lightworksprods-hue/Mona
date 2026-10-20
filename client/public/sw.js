const CACHE_NAME = 'mona-pos-shell-v4';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/mona-removebg-preview.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate' || requestUrl.pathname === '/' || requestUrl.pathname === '/index.html';

  // Always prefer the newest HTML document so it cannot reference stale,
  // deleted Vite chunks after a deployment.
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Never return index.html for a failed JS/CSS/image request. That
        // produces a misleading module MIME-type error in the browser.
        return new Response('', { status: 503, statusText: 'Offline asset unavailable' });
      });
    })
  );
});
