const CACHE_NAME = 'image-composer-v2.1.0';
const urlsToCache = [
  '/',
  '/app.html',
  '/app.js',
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
          // Remove any cache that's not the current version, but keep shared-files
          if (cacheName !== CACHE_NAME && cacheName !== 'shared-files' && cacheName !== 'shared-data') {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch 처리
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // POST 요청으로 들어오는 공유 타겟 처리
  if (event.request.method === 'POST' && url.pathname === '/app.html') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  
  // 캐시된 파일 제공
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

async function handleShareTarget(request) {
  console.log('🎯 Share Target 요청 받음');
  
  try {
    const formData = await request.formData();
    const files = formData.getAll('image');
    console.log(`📁 공유받은 파일 개수: ${files.length}`);

    // 파일을 Cache에 저장
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

    // 공유 데이터를 Cache에 저장
    const data = { 
      files: fileEntries,
      timestamp: Date.now()
    };
    console.log('💾 데이터 저장:', data);
    
    const dataCache = await caches.open('shared-data');
    await dataCache.put(
      '/shared-data/latest',
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    // UI 페이지로 리다이렉트
    console.log('🔄 리다이렉트: /app.html?shared=1');
    return Response.redirect('/app.html?shared=1', 303);
  } catch (e) {
    console.error('❌ Share Target 처리 실패:', e);
    return Response.redirect('/app.html', 303);
  }
}