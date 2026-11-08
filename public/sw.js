const CACHE_NAME = 'bottleforme-shell-v2';

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('BottleForMe', {
    body: 'You have new activity. Open BottleForMe to see it.',
    icon: '/logo.jpg',
    tag: 'bottleforme-inbox',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const home = windows.find((client) => new URL(client.url).pathname === '/');
    if (home) {
      await home.focus();
      home.postMessage({ type: 'bottleforme-open-inbox' });
    } else {
      await self.clients.openWindow('/?inbox=1');
    }
  })());
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('bottleforme-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;

  const isHome = request.mode === 'navigate' && url.pathname === '/';
  const isStatic = url.pathname.startsWith('/_next/static/') || ['/logo.jpg', '/manifest.json'].includes(url.pathname);
  if (!isHome && !isStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (isStatic) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      return cached || new Response('BottleForMe is offline.', { status: 503 });
    }
  })());
});
