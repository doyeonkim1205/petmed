// PawDex Service Worker v19
const CACHE_NAME = 'pawdex-v19';
const PRECACHE_URLS = ['/', '/offline.html', '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/notification-icon.png', '/icons/offline-illustration.svg'];

// Install: precache essential resources
// 저가형 기기에서 QuotaExceededError 발생해도 SW 설치 자체는 성공하도록 try-catch
//
// skipWaiting 을 호출하지 않음 → 새 SW 는 "waiting" 상태로 머물고,
// 유저가 UpdateToast 의 [지금 적용] 을 눌러야 활성화됨. 편집 중인 작업
// 날리는 자동 업데이트를 방지하기 위함.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        console.warn('SW precache failed (continuing without):', err?.name || err);
      }
    })()
  );
});

// 유저가 UpdateToast 의 [지금 적용] 을 누르면 클라이언트가
// postMessage({ type: 'SKIP_WAITING' }) 를 보내서 새 SW 가 활성화됨.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
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
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|svg|webp|woff2?|ico)$/)) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, clone))
            .catch((err) => {
              // QuotaExceededError on low-storage devices — 캐시 저장만 건너뜀
              console.warn('SW cache put failed:', err?.name || err);
            });
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
  let categoryIcon = '/icons/alarm.webp';  // 기본: 관리자/일반 알림
  switch (data.category) {
    case 'medication':
      categoryIcon = '/icons/med.webp';
      break;
    case 'appointment':
      categoryIcon = '/icons/cal.webp';
      break;
    case 'hospitalization':
      categoryIcon = '/icons/hos.webp';
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
