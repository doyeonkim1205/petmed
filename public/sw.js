// PawDex Service Worker v74
const CACHE_NAME = 'pawdex-v74';
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

// Activate: clean old caches → claim → 모든 클라이언트에 SW_ACTIVATED 메시지.
//
// 클라이언트는 이 메시지를 받고 reload — TWA 에서 controllerchange 가 늦거나
// fire 안 되는 race 를 우회. 첫 SW 설치 시에도 메시지가 가지만 클라이언트의
// UpdateToast 는 controller 없으면 listener 미등록이라 무시됨.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'SW_ACTIVATED' }));
  })());
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
//
// ⚠️ try/catch 필수: push 이벤트가 showNotification 없이 끝나면 브라우저가
// "spam" 으로 판단해 일정 횟수 후 푸시 권한을 자동 회수한다 (특히 iOS).
// payload 파싱이나 어떤 이유로 실패해도 fallback 알림을 반드시 띄워야 함.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    try {
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
        case 'subscription':
          // 구독/결제 알림 — alarm.webp 재사용 (전용 아이콘 없음).
          // 명시적으로 분기시켜 두면 향후 전용 아이콘 교체 용이.
          categoryIcon = '/icons/alarm.webp';
          break;
      }

      // ⚠️ tag 필수: web push spec 상 tag 가 비어있으면 기본 빈 문자열로
      // 처리되어 같은 origin 의 다른 알림과 서로 덮어씀. 같은 분에 예약+퇴원
      // 알림처럼 여러 push 가 도착하면 마지막 1건만 보이는 버그 발생.
      // 서버에서 보낸 data.tag 우선, 없으면 timestamp+random 으로 unique 보장.
      const options = {
        body: data.body || '',
        icon: categoryIcon,
        badge: '/icons/notification-icon.png',
        data: { url: data.url || '/' },
        tag: data.tag || `pawdex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      await self.registration.showNotification(title, options);
    } catch (err) {
      // showNotification 자체가 실패해도 권한 보호를 위해 폴백 시도.
      console.error('[sw.js] push handler error:', err);
      try {
        await self.registration.showNotification('PawDex', {
          body: '새 알림이 도착했어요',
          icon: '/icons/alarm.webp',
          badge: '/icons/notification-icon.png',
          data: { url: '/' },
        });
      } catch (fallbackErr) {
        console.error('[sw.js] fallback notification also failed:', fallbackErr);
      }
    }
  })());
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
