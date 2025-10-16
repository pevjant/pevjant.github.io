const CACHE_NAME = 'share-pwa-v1.0.1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 설치
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== 'shared-files') {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch 처리
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // POST 요청으로 들어오는 공유 타겟 처리
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  
  // 캐시된 파일 제공 (공유된 파일 포함)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

async function handleShareTarget(request) {
  console.log('🎯 Share Target 요청 받음');
  
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const sharedUrl = formData.get('url') || '';

    console.log('📝 공유 데이터:', { title, text, url: sharedUrl });

    // manifest.json의 name: "files"와 일치해야 함
    const files = formData.getAll('files') || [];
    console.log(`📁 파일 개수: ${files.length}`);

    // 파일을 Cache에 저장하고 접근 가능한 URL을 만들어서 클라이언트에 전달
    const fileEntries = [];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      console.log(`📎 파일 처리: ${file.name} (${file.type}, ${file.size} bytes)`);
      
      const fileUrl = `/shared/${crypto.randomUUID()}/${encodeURIComponent(file.name)}`;
      const cache = await caches.open('shared-files');
      await cache.put(fileUrl, new Response(file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' }
      }));
      fileEntries.push({
        name: file.name,
        type: file.type || '',
        size: file.size || 0,
        url: fileUrl
      });
    }

    // 모든 클라이언트에 공유 데이터 전달
    const data = { title, text, url: sharedUrl, files: fileEntries };
    console.log('📤 클라이언트로 전송:', data);
    
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    console.log(`👥 클라이언트 개수: ${allClients.length}`);
    
    for (const client of allClients) {
      client.postMessage({ type: 'shared-data', data });
    }

    // UI 페이지로 리다이렉트
    return Response.redirect('/?shared=1', 303);
  } catch (e) {
    console.error('❌ Share Target 처리 실패:', e);
    return new Response(`Share handling failed: ${e.message}`, { status: 500 });
  }
}