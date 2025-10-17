const CACHE_NAME = 'image-composer-v1.0.1';
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
  console.log('✅ Service Worker 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 캐시에 파일 추가:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('⚡ 즉시 활성화');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 현재 버전과 shared-files, shared-data를 제외한 모든 캐시 삭제
          if (cacheName !== CACHE_NAME && 
              cacheName !== 'shared-files' && 
              cacheName !== 'shared-data') {
            console.log('🗑️ 이전 캐시 삭제:', cacheName);
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
  if (event.request.method === 'POST' && (url.pathname === '/share' || url.pathname === '/app.html')) {
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

    // manifest.json의 name: "files" 또는 "image"와 일치
    const files = formData.getAll('files') || formData.getAll('image') || [];
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

    // 공유 데이터를 Cache에 저장 (페이지가 로드된 후 읽을 수 있도록)
    const data = { 
      title, 
      text, 
      url: sharedUrl, 
      files: fileEntries,
      timestamp: Date.now()
    };
    console.log('� 데이터 저장:', data);
    
    // Cache API를 사용하여 데이터 저장
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
    return new Response(`Share handling failed: ${e.message}`, { status: 500 });
  }
}