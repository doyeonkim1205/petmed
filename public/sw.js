// PawDex Service Worker v15
const CACHE_NAME = 'pawdex-v15';
const PRECACHE_URLS = ['/', '/offline.html', '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/notification-icon.png', '/icons/offline-illustration.svg'];

// Install: precache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // API: network only
  if (url.pathname.startsWith('/api/')) return;

  // Payment pages: always skip SW to avoid interfering with Toss redirects
  if (url.pathname.startsWith('/payment')) return;

  // External origins (Toss, Supabase, etc.): never intercept
  if (url.origin !== self.location.origin) return;

  // Navigation: network first → offline.html
  // 캐시된 페이지는 API 없이 제대로 동작 안 해서 (빈 기록, 로그인 실패 등)
  // 오프라인이면 offline.html 을 바로 보여주는 게 유저 혼란 최소
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Static assets: network first + cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|woff2?|ico)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PawDex';

  // 카테고리별 오른쪽 큰 아이콘 매핑 (data.category 기준)
  let categoryIcon = '/icons/alarm.png';  // 기본: 관리자/일반 알림
  switch (data.category) {
    case 'medication':
      categoryIcon = '/icons/med.png';
      break;
    case 'appointment':
      categoryIcon = '/icons/cal.png';
      break;
    case 'hospitalization':
      categoryIcon = '/icons/hos.png';
      break;
  }

  const options = {
    body: data.body || '',
    icon: categoryIcon,
    badge: '/icons/notification-icon.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
