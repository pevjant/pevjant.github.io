# PWA 이미지 크롭 & 합성 앱 개발 계획서

> **모바일 중심 설계** - 유튜브 자막 캡처 최적화

---

## 📋 프로젝트 개요

### 핵심 기능
- **이미지 입력**: 공유하기 / 갤러리에서 선택
- **영역 크롭**: 원하는 부분만 잘라내기
- **프리셋 시스템**: 자주 사용하는 크롭 영역 저장
- **배치 처리**: 여러 이미지 한번에 크롭
- **높이별 그룹**: 자막 크기별로 이미지 분류
- **코멘트 추가**: 각 이미지에 텍스트 추가
- **세로 합성**: 모든 이미지를 하나로 결합
- **메모리 최적화**: 필요한 영역만 저장

### 사용 시나리오
```
유튜브 영상 4장 캡처
  ↓
첫 번째: 큰 자막 (30% 높이) → 크롭
나머지 3장: 작은 자막 (20% 높이) → 일괄 크롭
  ↓
필요시 코멘트 추가
  ↓
세로로 합성 → 저장/공유
```

---

## 🛠 기술 스택

### 프레임워크
- **Vanilla JavaScript (ES6+)** - React 없이 경량 구현
- **인라인 CSS + CSS Grid** - 모바일 우선 반응형

### 핵심 Web API
- **Pointer Events API** - 터치/마우스 통합 드래그
- **Canvas API** - 이미지 크롭 및 합성
- **localStorage** - 프리셋 및 상태 저장
- **requestAnimationFrame** - 드래그 성능 최적화

### PWA 필수 설정
- Service Worker (오프라인 지원 + 캐시 관리)
- Web Share API (네이티브 공유)
- Web Share Target API (공유 받기)
- File API (이미지 불러오기)

---

## 📐 데이터 구조

```javascript
// 전역 상태
const state = {
  images: [],               // 이미지 배열
  customCropPresets: []     // 사용자 정의 프리셋
};

// 크롭 영역 (퍼센트 단위)
let cropArea = {
  x: 0,        // 좌측에서 %
  y: 0,        // 상단에서 %
  width: 100,  // 너비 %
  height: 25   // 높이 %
};

// 이미지 아이템
const imageItem = {
  id: string,
  file: File,
  dataUrl: string,
  cropped: boolean,
  cropData: {
    dataUrl: string,      // 크롭된 이미지 Data URL
    area: { x, y, width, height }
  },
  comment: string
};

// 사용자 정의 프리셋
const cropPreset = {
  id: string,
  name: string,
  area: { x, y, width, height },
  createdAt: number
};
```

---

## 🏗 앱 구조

```
app.html (3개 탭 구조)
│
├── [선택 탭]
│   ├── 파일 선택 버튼 (#fileInput)
│   └── 이미지 갤러리 (#imageGallery)
│       └── 이미지 카드 (썸네일 + 삭제 버튼)
│
├── [편집 탭]
│   ├── 대표 이미지 미리보기 (#cropPreview)
│   │   └── 드래그 가능한 크롭 박스 (#previewCropBox)
│   ├── 슬라이더 조정 (상/하/좌/우)
│   ├── 저장된 프리셋 목록 (#savedPresets)
│   ├── 프리셋 저장 버튼
│   └── 배치 크롭 버튼 (#batchCropButton)
│
└── [합성 탭]
    ├── 크롭된 이미지 목록
    │   ├── 이미지 미리보기
    │   ├── 코멘트 입력
    │   └── 크롭 영역 수정 버튼
    ├── 합성 옵션 (너비, 간격)
    ├── 합성 버튼 (#composeButton)
    └── 결과 이미지 (#resultPreview)
        ├── 다운로드 버튼
        └── 공유 버튼
```

### 주요 함수
- `setupPreviewDrag()` - 편집 탭 드래그 로직
- `setupEditDrag()` - 합성 탭 개별 수정 드래그
- `cropImage(dataUrl, area)` - Canvas 기반 크롭
- `composeImages()` - 세로 합성

---

## 🎯 주요 기능 구현

### 1. 이미지 선택

**파일 입력:**
```javascript
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    for (const file of files) {
        const dataUrl = await readFileAsDataURL(file);
        state.images.push({
            id: generateId(),
            file: file,
            dataUrl: dataUrl,
            cropped: false,
            cropData: null,
            comment: ''
        });
    }

    renderImageGallery();
    showToast(`${files.length}개 이미지 추가됨`);
});
```

**공유 받기 (Share Target API):**
```javascript
// Service Worker에서 공유 데이터 처리
self.addEventListener('fetch', (event) => {
    if (event.request.url.endsWith('/app.html') &&
        event.request.method === 'POST') {
        event.respondWith(handleShareTarget(event.request));
    }
});

// 앱에서 공유 데이터 로드
if (url.searchParams.get('shared') === '1') {
    const cache = await caches.open('shared-data');
    const response = await cache.match('/shared-data/latest');
    // ... 이미지 state에 추가
}
```

---

### 2. 슬라이더 기반 크롭 (편집 탭)

**4방향 슬라이더:**
```html
<input type="range" id="rangeTop" min="0" max="100"
       oninput="updateCropArea('top', this.value)">
<input type="range" id="rangeBottom" min="0" max="100"
       oninput="updateCropArea('bottom', this.value)">
<input type="range" id="rangeLeft" min="0" max="100"
       oninput="updateCropArea('left', this.value)">
<input type="range" id="rangeRight" min="0" max="100"
       oninput="updateCropArea('right', this.value)">
```

**크롭 영역 업데이트:**
```javascript
function updateCropArea(side, value) {
    const val = parseInt(value) || 0;

    switch(side) {
        case 'top':
            cropArea.y = val;
            cropArea.height = Math.max(1, 100 - val - (100 - cropArea.y - cropArea.height));
            break;
        case 'bottom':
            cropArea.height = Math.max(1, 100 - cropArea.y - val);
            break;
        case 'left':
            cropArea.x = val;
            cropArea.width = Math.max(1, 100 - val - (100 - cropArea.x - cropArea.width));
            break;
        case 'right':
            cropArea.width = Math.max(1, 100 - cropArea.x - val);
            break;
    }

    updateCropInputs();
    updatePreviewCropArea();
}
```

---

### 3. Pointer Events 드래그 (v2.4.0+)

**핵심 원리:**
- Mouse/Touch 이벤트 대신 **Pointer Events 일원화**
- `setPointerCapture()`로 안정성 확보
- `e.isPrimary` 체크로 중복 방지

**드래그 로직:**
```javascript
function setupPreviewDrag() {
    const cropBox = document.getElementById('previewCropBox');
    const img = overlay.previousElementSibling;

    let isDragging = false;
    let isResizing = false;
    let startX, startY, startCropArea, cachedRect;
    let pointerId = null;

    const onPointerMove = (e) => {
        if (!e.isPrimary || (!isDragging && !isResizing)) return;

        // ✅ 델타 계산 (v2.9.0 최신 - 상대 좌표 변환)
        // 절대 좌표 → overlay 기준 상대 좌표로 변환
        const currentX = e.clientX - cachedRect.left;
        const currentY = e.clientY - cachedRect.top;
        const prevX = startX - cachedRect.left;
        const prevY = startY - cachedRect.top;
        const dx = ((currentX - prevX) / cachedRect.width) * 100;
        const dy = ((currentY - prevY) / cachedRect.height) * 100;

        if (isDragging) {
            cropArea.x = Math.max(0, Math.min(100 - startCropArea.width,
                                              startCropArea.x + dx));
            cropArea.y = Math.max(0, Math.min(100 - startCropArea.height,
                                              startCropArea.y + dy));
        } else if (isResizing) {
            cropArea.width = Math.max(10, Math.min(100 - startCropArea.x,
                                                   startCropArea.width + dx));
            cropArea.height = Math.max(10, Math.min(100 - startCropArea.y,
                                                    startCropArea.height + dy));
        }

        // 즉시 스타일 반영 (v2.6.0)
        applyBoxStyles();

        // 입력 UI는 RAF로 스로틀
        if (!rafId) rafId = requestAnimationFrame(() => render(false));
    };

    const startMove = (e) => {
        if (e.button !== 0) return;  // 좌클릭만
        if (e.target !== cropBox) return;

        isDragging = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startCropArea = { ...cropArea };
        cachedRect = overlay.getBoundingClientRect();  // ← v2.9.0: overlay 사용

        cropBox.setPointerCapture(e.pointerId);
        e.preventDefault();
    };

    cropBox.addEventListener('pointerdown', startMove);
    cropBox.addEventListener('pointermove', onPointerMove);
    cropBox.addEventListener('pointerup', onPointerUp);
}
```

---

### 4. 사용자 정의 프리셋

**저장:**
```javascript
function saveCurrentPreset() {
    const name = prompt('프리셋 이름을 입력하세요:');
    if (name && name.trim()) {
        const preset = {
            id: generateId(),
            name: name.trim(),
            area: { ...cropArea },
            createdAt: Date.now()
        };
        state.customCropPresets.push(preset);
        localStorage.setItem('customCropPresets',
                           JSON.stringify(state.customCropPresets));

        renderSavedPresets();
        showToast('프리셋 저장됨 ✓');
    }
}
```

**불러오기:**
```javascript
function loadPreset(id) {
    const preset = state.customCropPresets.find(p => p.id === id);
    if (preset) {
        cropArea = { ...preset.area };
        updateCropInputs();
        updatePreviewCropArea();
        showToast(`"${preset.name}" 프리셋 로드됨`);
    }
}
```

---

### 5. 배치 크롭

**일괄 처리:**
```javascript
async function startBatchCrop() {
    const total = state.images.length;
    const area = { ...cropArea };  // 현재 크롭 영역 복사

    for (let i = 0; i < total; i++) {
        const img = state.images[i];

        const croppedDataUrl = await cropImage(img.dataUrl, area);
        img.cropped = true;
        img.cropData = {
            dataUrl: croppedDataUrl,
            area: { ...area }
        };

        // 진행률 표시
        const progress = ((i + 1) / total) * 100;
        progressFill.style.width = `${progress}%`;
    }

    showToast(`${total}개 이미지 크롭 완료`);
    switchTab('compose');  // 합성 탭으로 자동 이동
}
```

**Canvas 크롭 함수:**
```javascript
async function cropImage(dataUrl, area) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 퍼센트 → 픽셀 변환
            const x = (area.x / 100) * img.width;
            const y = (area.y / 100) * img.height;
            const width = (area.width / 100) * img.width;
            const height = (area.height / 100) * img.height;

            canvas.width = width;
            canvas.height = height;

            // 원본에서 크롭 영역만 추출
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

            // JPEG 90% 압축 (메모리 최적화)
            resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.src = dataUrl;
    });
}
```

---

### 6. 세로 합성 (합성 탭)

**Canvas 합성:**
```javascript
async function composeImages() {
    const croppedImages = state.images.filter(img => img.cropped);
    const maxWidth = parseInt(document.getElementById('maxWidth').value) || 1080;
    const padding = parseInt(document.getElementById('padding').value) || 10;

    // 1. 전체 높이 계산
    let totalHeight = padding;
    const imageHeights = [];

    for (const img of croppedImages) {
        const image = await loadImage(img.cropData.dataUrl);
        const height = (maxWidth / image.width) * image.height;
        imageHeights.push(height);
        totalHeight += height + padding;

        if (img.comment) {
            totalHeight += 60 + padding;  // 코멘트 영역
        }
    }

    // 2. Canvas 생성
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // 3. 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 4. 이미지와 코멘트 배치
    let currentY = padding;

    for (let i = 0; i < croppedImages.length; i++) {
        const img = croppedImages[i];
        const image = await loadImage(img.cropData.dataUrl);
        const height = imageHeights[i];

        // 이미지 그리기
        ctx.drawImage(image, 0, currentY, maxWidth, height);
        currentY += height + padding;

        // 코멘트 그리기
        if (img.comment) {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, currentY, maxWidth, 50);

            ctx.fillStyle = '#374151';
            ctx.font = '16px sans-serif';
            ctx.fillText(img.comment, 15, currentY + 30);
            currentY += 60 + padding;
        }
    }

    const resultDataUrl = canvas.toDataURL('image/png');
    state.resultImage = resultDataUrl;

    // 결과 표시
    document.getElementById('resultImage').src = resultDataUrl;
    document.getElementById('resultPreview').classList.remove('hidden');
}
```

---

### 7. 저장 및 공유

**다운로드:**
```javascript
function downloadResult() {
    const link = document.createElement('a');
    link.download = `composed-${Date.now()}.png`;
    link.href = state.resultImage;
    link.click();
}
```

**Web Share API:**
```javascript
async function shareResult() {
    const blob = await (await fetch(state.resultImage)).blob();
    const file = new File([blob], 'composed-image.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
            files: [file],
            title: '합성 이미지',
            text: '이미지 확인해주세요'
        });
    } else {
        downloadResult();  // fallback
    }
}
```

---

## 🐛 디버그 모드

**활성화 방법:**
```
?debug=1 쿼리 파라미터 추가
또는
localStorage.setItem('DEBUG_DRAG', '1')
```

**로그 출력 내용:**
- 드래그 이벤트 통계 (move count, render count)
- 델타 계산 값 (dx, dy)
- 렌더 지연 (latency)
- Coalesced 이벤트 수
- 스크롤 변화

**코드:**
```javascript
function isDebug() {
    return /(^|[?&])debug=1(&|$)/.test(location.search) ||
           localStorage.getItem('DEBUG_DRAG') === '1';
}

function dlog(scope, ...args) {
    if (!isDebug()) return;
    console.log(`[${new Date().toISOString()}][${scope}]`, ...args);
}

// 사용
dlog('preview:move', { dx, dy, cropArea });
```

---

## ⚠️ 알려진 제한사항

### 1. 높이별 그룹핑 미구현
- **계획**: 큰 자막/작은 자막 그룹 분리
- **현재**: 모든 이미지에 동일한 크롭 영역만 적용 가능
- **대안**: 개별 이미지를 합성 탭에서 하나씩 수정

### 2. 기본 프리셋 없음
- **계획**: 유튜브 자막, 하단 30%, 하단 20% 기본 제공
- **현재**: 사용자가 직접 만들어야 함
- **이유**: v2.0.0에서 슬라이더 방식으로 전환하며 의도적 제거

### 3. 배치 크롭 취소 불가
- **현재**: 진행 중 중단 불가능
- **개선 필요**: 취소 버튼 및 개별 이미지 실패 처리

### 4. 리사이즈 핸들 1개
- **현재**: 우하단 핸들만 제공
- **개선 가능**: 4개 코너 핸들로 확장

---

## 🔄 버전 히스토리

### v2.9.0 (2025-10-17) - 현재
- **🔧 FIX: 드래그 델타 계산 방식 개선**
  - 절대 좌표 → overlay 기준 상대 좌표로 변환
  - `cachedRect = overlay.getBoundingClientRect()` 사용
  - 스크롤 시에도 정확한 드래그 동작
- 디버그 로그 간격 200ms로 조정 (성능 개선)

### v2.8.1 (2025-10-17)
- 디버그 로그 간격 1ms로 변경

### v2.8.0 (2025-10-17)
- **🔧 FIX: 드래그 델타 계산 오류 수정**
  - `cachedRect = cropBox.getBoundingClientRect()` → `img.getBoundingClientRect()`
  - 근본 원인: cropBox 크기로 % 계산 → 부정확
  - 해결: img 전체 크기로 % 계산 → 정확

### v2.7.0 (2025-10-17)
- 앱 버전 및 Service Worker 캐시 이름 동기화

### v2.6.0 (2025-10-17)
- **RAF 의존 축소**: 스타일 즉시 반영, 입력만 100ms 스로틀
- 첫 프레임 지연 제거
- 디버그 카운터 초기화 보강

### v2.5.0 (2025-10-17)
- 디버깅 로그 추가 (?debug=1)
- 드래그 이벤트 상세 통계 수집
- README 디버그 섹션 추가

### v2.4.0 (2025-10-17)
- **Pointer Events로 드래그 일원화**
- mouse/touch → pointer 이벤트 통합
- setPointerCapture 활용
- 입력 업데이트 100ms 스로틀

### v2.3.0 (2025-10-17)
- 드래그 로직 단순화

### v2.0.0 (2025-10-17)
- **고정 프리셋 제거 → 슬라이더 방식 전환**
- 상/하/좌/우 슬라이더로 자유 조정
- 사용자 정의 프리셋 저장/불러오기 추가
- 대표 이미지 미리보기
- 합성 탭 개별 수정 슬라이더 방식 변경
- DOM 재생성 대신 스타일 업데이트 (성능 개선)

### v1.0.1 (2025-10-17)
- Share Target 기능 복원 및 개선
- Android 공유 받기 수정

### v1.0.0 (2025-10-17)
- 핵심 기능 구현
- 이미지 선택 및 갤러리
- 크롭 프리셋 시스템
- 개별 크롭 편집기
- 배치 크롭 처리
- 세로 이미지 합성
- 코멘트 추가 기능
- 다운로드 및 공유

---

## 🚀 향후 개선 계획

### 우선순위 높음
1. **높이별 그룹핑 시스템 구현**
   - HeightGroup 데이터 구조 추가
   - 그룹별 일괄 크롭 기능
   - 빠른 생성 버튼 (큰 자막/작은 자막)

2. **기본 프리셋 3개 추가**
   - 유튜브 자막 (y:75, h:25)
   - 하단 30% (y:70, h:30)
   - 하단 20% (y:80, h:20)

3. **에러 처리 강화**
   - 배치 크롭 취소 기능
   - 개별 이미지 실패 시 계속 진행
   - 이미지 로드 실패 케이스 처리

### 우선순위 중간
4. **크롭 UX 개선**
   - 리사이즈 핸들 4개로 확장
   - 종횡비 고정 옵션
   - 키보드 방향키로 미세 조정

5. **프로젝트 저장 기능**
   - 작업 중인 상태 저장
   - 나중에 이어서 작업

### 우선순위 낮음
6. **디버그 로그 정리**
   - 프로덕션 빌드에서 자동 제거
   - 환경 변수로 제어

7. **React 마이그레이션 고려**
   - 컴포넌트 구조화
   - react-image-crop 도입 검토
   - 단위 테스트 작성

---

## 💡 성능 최적화 팁

### 1. 메모리 관리
```javascript
// JPEG 압축으로 메모리 절약
canvas.toDataURL('image/jpeg', 0.90);  // 90% 품질

// 대용량 이미지는 maxWidth로 제한
const maxWidth = 1080;
```

### 2. DOM 조작 최소화
```javascript
// ❌ 나쁜 예: 매번 DOM 재생성
overlay.innerHTML = `<div>...</div>`;

// ✅ 좋은 예: 스타일만 업데이트
cropBox.style.left = cropArea.x + '%';
```

### 3. RAF 활용
```javascript
// 입력 UI는 스로틀, 스타일은 즉시
applyBoxStyles();  // 즉시
if (!rafId) rafId = requestAnimationFrame(() => updateInputs());  // 스로틀
```
## 📦 배포

### GitHub Pages (현재 사용 중)
```bash
# 1. 저장소에 푸시
git add .
git commit -m "docs: 계획서 업데이트"
git push origin main

# 2. GitHub Pages 자동 배포
# https://pevjant.github.io/app.html
```

### PWA 체크리스트
- [x] manifest.json
- [x] service-worker.js  
- [x] HTTPS (GitHub Pages 자동)
- [x] 192x192, 512x512 아이콘
- [x] 오프라인 fallback
- [x] Share Target API

---

## 🔗 참고 자료

- [Pointer Events API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

## 📞 문의 및 피드백

프로젝트 개선 아이디어나 버그 리포트는 GitHub Issues로 등록해주세요.

---

**마지막 업데이트: 2025-10-17**
**현재 버전: v2.9.0**
