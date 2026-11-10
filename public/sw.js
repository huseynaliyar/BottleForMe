const CACHE_NAME = 'bottleforme-shell-v2';

self.addEventListener('push', (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { /* Older alerts may lack a JSON payload. */ }
  const title = typeof payload?.title === 'string' && payload.title.trim() ? payload.title : 'BottleForMe';
  const body = typeof payload?.body === 'string' && payload.body.trim()
    ? payload.body : 'You have new activity. Open BottleForMe to see it.';
  const id = typeof payload?.id === 'string' && /^[0-9a-f-]{36}$/i.test(payload.id) ? payload.id : '';
  const pickupId = typeof payload?.pickupId === 'string' && /^[0-9a-f-]{36}$/i.test(payload.pickupId) ? payload.pickupId : null;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { pickupId, pickupChat: payload?.pickupChat === true },
    icon: '/logo.jpg',
    tag: id ? 'bottleforme-inbox-' + id : 'bottleforme-inbox',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const pickupId = event.notification.data?.pickupId ?? null;
    const pickupChat = event.notification.data?.pickupChat === true;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const home = windows.find((client) => {
      const path = new URL(client.url).pathname;
      return path === '/' || path.startsWith('/pickups/');
    });
    if (home) {
      await home.focus();
      home.postMessage({ type: 'bottleforme-open-inbox', pickupId, pickupChat });
    } else {
      await self.clients.openWindow(pickupId ? '/pickups/' + encodeURIComponent(pickupId) + (pickupChat ? '?chat=1' : '') : '/?inbox=1');
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
