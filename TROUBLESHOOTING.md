# 안드로이드 PWA 공유 타겟 문제 해결 가이드

## 🔍 문제 분석

안드로이드에서 PWA가 "공유하기" 메뉴에 나타나지 않는 이유를 단계적으로 분석했습니다.

### 발견된 주요 문제

#### 1. ❌ 아이콘 파일 경로 불일치 (핵심 문제)
- **문제**: `manifest.json`에 `/icon-192.png`, `/icon-512.png`로 정의
- **실제 파일**: `icon-192x192.png`, `icon-512x512.png`
- **영향**: 안드로이드가 PWA 아이콘을 로드할 수 없어 Share Target으로 인식하지 못함

#### 2. ⚠️ 서비스 워커 캐시 미흡
- 아이콘 파일이 서비스 워커 캐시에 포함되지 않음
- 오프라인에서 접근 불가능

#### 3. ⚠️ 공유 데이터 처리 로직 개선 필요
- Service Worker와 클라이언트 간 메시지 전달 개선
- 파일 공유 처리 로직 추가

---

## ✅ 적용된 해결 방법

### 1. manifest.json 수정
```json
{
  "icons": [
    {
      "src": "/icon-192x192.png",  // ✅ 실제 파일명과 일치
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"    // ✅ purpose 추가
    },
    {
      "src": "/icon-512x512.png",  // ✅ 실제 파일명과 일치
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"    // ✅ purpose 추가
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "files",
          "accept": ["image/*", "video/*", "audio/*", "text/*"]
        }
      ]
    }
  }
}
```

### 2. sw.js (서비스 워커) 개선
```javascript
// ✅ 캐시 버전 업그레이드
const CACHE_NAME = 'share-pwa-v2';

// ✅ 아이콘 파일 캐시에 추가
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// ✅ 설치 시 캐시 저장
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// ✅ 활성화 시 이전 캐시 삭제
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

// ✅ Fetch 핸들러 개선 (캐시 우선)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### 3. index.html 공유 처리 로직 개선
```javascript
// ✅ Service Worker 메시지 리스너 개선
window.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data.type === 'shared-data') {
                displaySharedContent(event.data.data);
            }
        });
        
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'request-shared-data'
            });
        }
    }
});
```

---

## 📱 안드로이드에서 테스트하는 방법

### 1단계: PWA 재설치
```
⚠️ 중요: manifest.json 변경 후 반드시 PWA를 재설치해야 합니다!

1. 안드로이드 Chrome에서 https://pevjant.github.io 접속
2. 기존 PWA가 설치되어 있다면:
   - 홈 화면에서 앱 아이콘 길게 누르기
   - "앱 정보" → "제거" 또는 "삭제"
3. Chrome에서 다시 사이트 접속
4. 주소창 옆 "설치" 버튼 클릭
5. "홈 화면에 추가" 또는 "설치" 선택
```

### 2단계: 공유 메뉴 확인
```
1. 갤러리 또는 다른 앱 실행
2. 이미지, 텍스트, URL 등을 선택
3. "공유" 버튼 탭
4. 앱 목록에 "SharePWA" 또는 "My Share PWA" 확인
5. PWA 선택하면 공유된 콘텐츠가 표시됨
```

### 3단계: 디버깅 (문제가 계속되는 경우)
```
Chrome DevTools 원격 디버깅:

1. 안드로이드에서 "개발자 옵션" 활성화
2. "USB 디버깅" 켜기
3. PC에서 Chrome 열고 chrome://inspect 접속
4. 안드로이드 기기가 보이면 "inspect" 클릭
5. Console/Application 탭에서 에러 확인
```

---

## 🔧 추가 체크리스트

### Manifest 요구사항
- ✅ `name` 또는 `short_name` 정의
- ✅ `start_url` 정의 (`/`)
- ✅ `display: "standalone"` 또는 `"fullscreen"`
- ✅ `icons`: 192x192, 512x512 크기
- ✅ `icons`: 실제 파일 경로와 일치
- ✅ `share_target` 정의
- ✅ `share_target.action` 경로 (`/share`)
- ✅ `share_target.method: "POST"`
- ✅ `share_target.enctype: "multipart/form-data"`
- ✅ `share_target.params.files` 배열

### Service Worker 요구사항
- ✅ HTTPS 또는 localhost에서 서비스
- ✅ `/sw.js` 등록됨
- ✅ Scope가 `/`를 포함
- ✅ `/share` POST 요청 처리
- ✅ 파일 공유 처리 로직

### 안드로이드 특정 요구사항
- ✅ Chrome 84 이상 (Share Target Level 2 지원)
- ✅ PWA가 홈 화면에 설치됨
- ✅ Manifest 파일이 올바르게 로드됨
- ✅ 아이콘이 올바르게 로드됨

---

## 📊 테스트 도구

### 1. 로컬 테스트 페이지
https://pevjant.github.io/test-share.html

이 페이지에서 다음을 확인할 수 있습니다:
- Web Share API 지원 여부
- Service Worker 등록 상태
- Manifest 내용
- 텍스트/URL/이미지 공유 테스트

### 2. Chrome DevTools
```
Application 탭:
- Manifest: 모든 필드가 올바른지 확인
- Service Workers: 활성화 상태 확인
- Cache Storage: 아이콘이 캐시되었는지 확인

Console 탭:
- Service Worker 등록 에러 확인
- Manifest 파싱 에러 확인
```

### 3. Lighthouse 검사
```
1. Chrome DevTools → Lighthouse 탭
2. "Progressive Web App" 체크
3. "Analyze page load" 클릭
4. "Installable" 섹션 확인
```

---

## 🐛 일반적인 문제와 해결법

### 1. PWA가 공유 메뉴에 나타나지 않음
- ✅ 아이콘 파일 경로 확인 (실제 파일과 일치하는지)
- ✅ PWA 재설치 (manifest 변경 후)
- ✅ 안드로이드 Chrome 버전 확인 (84+)
- ✅ HTTPS 프로토콜 확인

### 2. 공유는 되지만 이미지가 표시되지 않음
- ✅ Service Worker의 `handleShareTarget` 함수 확인
- ✅ `formData.getAll('files')` 파라미터명 확인 (manifest와 일치)
- ✅ Cache API에 파일이 저장되는지 확인
- ✅ 클라이언트에 postMessage로 전달되는지 확인

### 3. 서비스 워커가 업데이트되지 않음
```javascript
// Chrome DevTools → Application → Service Workers
// "Update on reload" 체크
// "Unregister" 클릭 후 페이지 새로고침
```

### 4. 캐시 문제
```javascript
// 캐시 버전을 올려서 강제 업데이트
const CACHE_NAME = 'share-pwa-v3'; // v2 → v3
```

---

## 📚 참고 자료

### 공식 문서
- [Web Share Target API](https://web.dev/web-share-target/)
- [PWA Manifest](https://web.dev/add-manifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### 브라우저 지원
- Chrome 84+ (Android)
- Edge 84+ (Android)
- Samsung Internet 12+

### 알려진 제한사항
- iOS Safari는 Share Target API를 지원하지 않음
- 데스크톱 브라우저는 제한적 지원
- 일부 안드로이드 제조사 브라우저는 미지원

---

## 💡 추가 개선 제안

### 1. 더 나은 아이콘
```json
// manifest.json
"icons": [
  {
    "src": "/icon-72x72.png",
    "sizes": "72x72",
    "type": "image/png"
  },
  {
    "src": "/icon-96x96.png",
    "sizes": "96x96",
    "type": "image/png"
  },
  {
    "src": "/icon-128x128.png",
    "sizes": "128x128",
    "type": "image/png"
  },
  {
    "src": "/icon-144x144.png",
    "sizes": "144x144",
    "type": "image/png"
  },
  {
    "src": "/icon-192x192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "/icon-512x512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

### 2. 오프라인 지원 강화
```javascript
// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // 동적 캐싱
          if (event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // 오프라인 폴백 페이지
        return caches.match('/offline.html');
      })
  );
});
```

### 3. 공유 분석 추가
```javascript
// index.html
function displaySharedContent(data) {
  // ... 기존 코드 ...
  
  // 분석 전송
  if (typeof gtag !== 'undefined') {
    gtag('event', 'share_received', {
      'has_title': !!data.title,
      'has_text': !!data.text,
      'has_url': !!data.url,
      'file_count': data.files?.length || 0
    });
  }
}
```

---

## ✅ 최종 체크리스트

변경사항을 GitHub Pages에 푸시했으므로:

- [x] manifest.json 아이콘 경로 수정
- [x] manifest.json purpose 속성 추가
- [x] sw.js 캐시 버전 업그레이드
- [x] sw.js 아이콘 파일 캐시 추가
- [x] sw.js fetch 핸들러 개선
- [x] index.html 공유 처리 로직 개선
- [x] test-share.html 테스트 페이지 추가
- [x] GitHub Pages에 배포 완료

### 다음 단계:
1. 안드로이드 기기에서 https://pevjant.github.io 접속
2. 기존 PWA 삭제 (있다면)
3. PWA 재설치
4. 갤러리 등에서 이미지 공유 테스트
5. 공유 메뉴에 "SharePWA" 앱이 보이는지 확인

문제가 계속되면 Chrome DevTools로 원격 디버깅하여 에러 메시지를 확인하세요!
