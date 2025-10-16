const CACHE_NAME = 'share-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// 설치
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// 활성화
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch 처리
self.addEventListener('fetch', (event) => {
  // POST 요청 (공유 데이터) 처리
  if (event.request.method === 'POST' && event.request.url.endsWith('/share')) {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const data = {
          title: formData.get('title'),
          text: formData.get('text'),
          url: formData.get('url')
        };
        
        // 파일 처리
        const files = formData.getAll('files');
        if (files && files.length > 0) {
          data.files = files;
        }
        
        // 클라이언트에 데이터 전달
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'shared-data',
            data: data
          });
        });
        
        // 메인 페이지로 리디렉션
        return Response.redirect('/', 303);
      })()
    );
    return;
  }
  
  // 일반 GET 요청 처리
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});