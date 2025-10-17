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
- **React + TypeScript** (PWA 기반)
- **Tailwind CSS** (모바일 우선 반응형)

### 핵심 라이브러리
```bash
npm install react-image-crop      # 크롭 UI
npm install zustand               # 상태 관리
```

### PWA 필수 설정
- Service Worker (오프라인 지원)
- Web Share API (네이티브 공유)
- Web Share Target API (공유 받기)
- File System Access API (갤러리 접근)

---

## 📐 데이터 구조

{% raw %}
```typescript
// 크롭 프리셋
interface CropPreset {
  id: string;
  name: string;
  cropArea: {
    x: number;      // 퍼센트
    y: number;
    width: number;
    height: number;
  };
}

// 높이 그룹
interface HeightGroup {
  id: string;
  name: string;           // "큰 자막", "작은 자막"
  heightPercent: number;  // 하단에서 잘라낼 높이
  color: string;
  imageIds: string[];
}

// 이미지 아이템
interface ImageItem {
  id: string;
  originalFile: File;
  originalDataUrl: string;
  
  status: 'pending' | 'cropped' | 'skipped';
  
  cropData?: {
    croppedDataUrl: string;
    cropArea: CropArea;
  };
  
  heightGroupId?: string;
  comment: string;
  order: number;
}

// 합성 설정
interface CompositeSettings {
  maxWidth: number;       // 기본: 1080
  padding: number;        // 이미지 간격
  commentStyle: {
    fontSize: number;
    color: string;
    backgroundColor: string;
    padding: number;
  };
}
```
{% endraw %}

---

## 🏗 컴포넌트 구조

```
App
├── ImageInput          (이미지 불러오기)
│   ├── ShareReceiver   (공유 받기)
│   └── GalleryPicker   (갤러리 선택)
│
├── PresetManager       (프리셋 관리)
│   └── PresetCard      (프리셋 카드)
│
├── ImageGallery        (이미지 목록)
│   └── ImageCard       (개별 이미지)
│
├── HeightGroupManager  (높이별 그룹)
│   └── GroupCard       (그룹 카드)
│
├── BatchCropTool       (배치 크롭)
│
├── CropEditor          (개별 크롭 편집)
│   ├── CropCanvas      (크롭 영역)
│   └── CommentInput    (코멘트 입력)
│
└── Compositor          (합성 & 결과)
    ├── PreviewCanvas   (미리보기)
    └── ActionButtons   (저장/공유)
```

---

## 🎯 Phase별 구현 계획

### Phase 1: 프로젝트 셋업 (1-2일)

```bash
# 1. 프로젝트 생성
npx create-react-app image-composer --template typescript
cd image-composer

# 2. 라이브러리 설치
npm install react-image-crop zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 3. PWA 설정
# - public/manifest.json 수정
# - service-worker.js 활성화
```

**manifest.json**
```json
{
  "name": "Image Composer",
  "short_name": "ImgComp",
  "description": "이미지 크롭 & 합성 도구",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#4A90E2",
  "background_color": "#ffffff",
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{
        "name": "image",
        "accept": ["image/*"]
      }]
    }
  }
}
```

---

### Phase 2: 이미지 입력 구현 (2-3일)

#### 갤러리 선택
```typescript
const GalleryPicker: React.FC = () => {
  const addImages = useStore(state => state.addImages);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    const images = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await readFileAsDataURL(file);
        return {
          id: generateId(),
          originalFile: file,
          originalDataUrl: dataUrl,
          status: 'pending' as const,
          comment: '',
          order: 0
        };
      })
    );
    
    addImages(images);
  };
  
  return (
    <div className="p-4">
      <label className="block w-full p-8 border-2 border-dashed rounded-lg text-center cursor-pointer">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-4xl mb-2">📁</div>
        <div className="text-lg">이미지 선택</div>
      </label>
    </div>
  );
};
```

#### 공유 받기
```typescript
// App.tsx
useEffect(() => {
  const handleSharedFiles = async () => {
    if (window.location.pathname === '/share') {
      const formData = await getSharedFormData();
      const files = formData.getAll('image') as File[];
      
      // 파일 처리 후 메인으로 리다이렉트
      await processFiles(files);
      window.location.href = '/';
    }
  };
  
  handleSharedFiles();
}, []);
```

---

### Phase 3: 프리셋 시스템 (2-3일)

```typescript
const PresetManager: React.FC = () => {
  const [presets, setPresets] = useState<CropPreset[]>([]);
  
  // 기본 프리셋
  const defaultPresets: CropPreset[] = [
    {
      id: 'youtube-subtitle',
      name: '유튜브 자막',
      cropArea: { x: 0, y: 75, width: 100, height: 25 }
    },
    {
      id: 'bottom-30',
      name: '하단 30%',
      cropArea: { x: 0, y: 70, width: 100, height: 30 }
    },
    {
      id: 'bottom-20',
      name: '하단 20%',
      cropArea: { x: 0, y: 80, width: 100, height: 20 }
    }
  ];
  
  useEffect(() => {
    const saved = localStorage.getItem('cropPresets');
    setPresets(saved ? JSON.parse(saved) : defaultPresets);
  }, []);
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4">크롭 프리셋</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {presets.map(preset => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className="p-4 border rounded-lg active:bg-gray-100"
          >
            <div className="font-medium">{preset.name}</div>
            <div className="text-sm text-gray-500">
              {preset.cropArea.height}% 높이
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

### Phase 4: 높이별 그룹핑 (3-4일)

```typescript
const HeightGroupManager: React.FC = () => {
  const { images, heightGroups, createGroup, processGroup } = useStore();
  
  return (
    <div className="p-4">
      <h3 className="text-lg font-bold mb-4">높이별 그룹</h3>
      
      {heightGroups.map(group => (
        <div
          key={group.id}
          className="mb-4 p-4 border-l-4 rounded"
          style={{ borderColor: group.color }}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-medium">{group.name}</span>
              <span className="ml-2 text-sm text-gray-500">
                {group.heightPercent}%
              </span>
            </div>
            <span className="text-sm">
              {group.imageIds.length}개
            </span>
          </div>
          
          {/* 이미지 썸네일 */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {group.imageIds.slice(0, 4).map(id => {
              const img = images.find(i => i.id === id);
              return (
                <img
                  key={id}
                  src={img?.originalDataUrl}
                  className="w-16 h-16 object-cover rounded"
                />
              );
            })}
          </div>
          
          <button
            onClick={() => processGroup(group.id)}
            className="w-full py-2 bg-blue-500 text-white rounded active:bg-blue-600"
          >
            ✂️ 일괄 크롭
          </button>
        </div>
      ))}
      
      {/* 빠른 생성 버튼 */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={() => createGroup('큰 자막', 30)}
          className="py-3 border rounded active:bg-gray-100"
        >
          큰 자막 (30%)
        </button>
        <button
          onClick={() => createGroup('작은 자막', 20)}
          className="py-3 border rounded active:bg-gray-100"
        >
          작은 자막 (20%)
        </button>
      </div>
    </div>
  );
};
```

---

### Phase 5: 배치 크롭 처리 (3-4일)

```typescript
const BatchCropTool: React.FC = () => {
  const { selectedImages, selectedPreset } = useStore();
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const applyBatchCrop = async () => {
    if (!selectedPreset) return;
    
    setIsProcessing(true);
    const total = selectedImages.length;
    
    for (let i = 0; i < total; i++) {
      const image = selectedImages[i];
      const croppedDataUrl = await cropImage(
        image.originalDataUrl,
        selectedPreset.cropArea
      );
      
      updateImage(image.id, {
        status: 'cropped',
        cropData: {
          croppedDataUrl,
          cropArea: selectedPreset.cropArea
        }
      });
      
      setProgress(((i + 1) / total) * 100);
    }
    
    setIsProcessing(false);
    showToast(`${total}개 이미지 처리 완료`);
  };
  
  return (
    <div className="p-4">
      <div className="mb-4">
        <span className="text-lg font-medium">
          선택: {selectedImages.length}개
        </span>
      </div>
      
      {isProcessing && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-center mt-2 text-sm">
            {Math.round(progress)}%
          </div>
        </div>
      )}
      
      <button
        onClick={applyBatchCrop}
        disabled={!selectedPreset || isProcessing}
        className="w-full py-3 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        {isProcessing ? '처리 중...' : '일괄 크롭 시작'}
      </button>
    </div>
  );
};

// 크롭 함수
const cropImage = async (
  dataUrl: string,
  cropArea: CropArea
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const x = (cropArea.x / 100) * img.width;
      const y = (cropArea.y / 100) * img.height;
      const width = (cropArea.width / 100) * img.width;
      const height = (cropArea.height / 100) * img.height;
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      
      // JPEG 압축으로 메모리 절약
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
};
```

---

### Phase 6: 이미지 합성 (3-4일)

```typescript
const composeImages = async (
  images: ImageItem[],
  settings: CompositeSettings
): Promise<string> => {
  // 1. 전체 높이 계산
  const processedImages = images
    .filter(img => img.status === 'cropped')
    .sort((a, b) => a.order - b.order);
  
  let totalHeight = settings.padding;
  const imageHeights: number[] = [];
  
  for (const img of processedImages) {
    const image = await loadImage(img.cropData!.croppedDataUrl);
    const height = (settings.maxWidth / image.width) * image.height;
    imageHeights.push(height);
    totalHeight += height + settings.padding;
    
    // 코멘트 공간
    if (img.comment) {
      totalHeight += calculateTextHeight(
        img.comment,
        settings.maxWidth,
        settings.commentStyle
      ) + settings.padding;
    }
  }
  
  // 2. Canvas 생성
  const canvas = document.createElement('canvas');
  canvas.width = settings.maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;
  
  // 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 3. 이미지와 텍스트 배치
  let currentY = settings.padding;
  
  for (let i = 0; i < processedImages.length; i++) {
    const img = processedImages[i];
    const image = await loadImage(img.cropData!.croppedDataUrl);
    
    // 이미지 그리기
    const height = imageHeights[i];
    ctx.drawImage(image, 0, currentY, settings.maxWidth, height);
    currentY += height + settings.padding;
    
    // 코멘트 그리기
    if (img.comment) {
      const textHeight = drawComment(
        ctx,
        img.comment,
        currentY,
        settings.maxWidth,
        settings.commentStyle
      );
      currentY += textHeight + settings.padding;
    }
  }
  
  return canvas.toDataURL('image/png');
};

// 텍스트 그리기
const drawComment = (
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  style: CommentStyle
): number => {
  ctx.font = `${style.fontSize}px sans-serif`;
  const lines = wrapText(ctx, text, maxWidth - style.padding * 2);
  const lineHeight = style.fontSize * 1.5;
  const totalHeight = lines.length * lineHeight + style.padding * 2;
  
  // 배경
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, y, maxWidth, totalHeight);
  
  // 텍스트
  ctx.fillStyle = style.color;
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      style.padding,
      y + style.padding + (index + 1) * lineHeight
    );
  });
  
  return totalHeight;
};

// 텍스트 줄바꿈
const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  
  lines.push(currentLine.trim());
  return lines;
};
```

---

### Phase 7: 결과 저장 & 공유 (1-2일)

```typescript
const ResultViewer: React.FC<{ resultImage: string }> = ({ resultImage }) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `composed-${Date.now()}.png`;
    link.href = resultImage;
    link.click();
  };
  
  const handleShare = async () => {
    try {
      const blob = await (await fetch(resultImage)).blob();
      const file = new File([blob], 'composed-image.png', { 
        type: 'image/png' 
      });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '합성 이미지',
          text: '이미지를 확인해주세요'
        });
      } else {
        handleDownload();
      }
    } catch (error) {
      console.error('Share failed:', error);
      handleDownload();
    }
  };
  
  return (
    <div className="p-4">
      <img 
        src={resultImage} 
        alt="합성 결과"
        className="w-full rounded-lg mb-4"
      />
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDownload}
          className="py-3 bg-green-500 text-white rounded active:bg-green-600"
        >
          💾 저장
        </button>
        <button
          onClick={handleShare}
          className="py-3 bg-blue-500 text-white rounded active:bg-blue-600"
        >
          📤 공유
        </button>
      </div>
    </div>
  );
};
```

---

## 📱 모바일 최적화

### 1. 터치 제스처
```typescript
// 핀치 줌 (크롭 영역 조정)
const usePinchZoom = (elementRef: RefObject<HTMLElement>) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    let initialDistance = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;
        // 크롭 영역 크기 조정
      }
    };
    
    element.addEventListener('touchstart', handleTouchStart);
    element.addEventListener('touchmove', handleTouchMove);
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);
};
```

### 2. 성능 최적화
```typescript
// 이미지 리사이징 (메모리 절약)
const optimizeImage = async (
  dataUrl: string,
  maxWidth: number = 1920
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height / width) * maxWidth;
        width = maxWidth;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = dataUrl;
  });
};

// 메모리 사용량 체크
const checkMemoryUsage = (images: ImageItem[]): number => {
  let totalBytes = 0;
  
  images.forEach(img => {
    if (img.cropData) {
      const base64 = img.cropData.croppedDataUrl.split(',')[1];
      totalBytes += (base64.length * 3) / 4;
    }
  });
  
  return totalBytes / (1024 * 1024); // MB
};
```

### 3. 반응형 레이아웃
```css
/* Tailwind 기반 모바일 우선 */
.image-grid {
  @apply grid gap-2;
  @apply grid-cols-2;      /* 기본: 2열 */
  @apply sm:grid-cols-3;   /* 작은 태블릿: 3열 */
  @apply md:grid-cols-4;   /* 태블릿: 4열 */
}

.action-button {
  @apply w-full py-3 rounded-lg;
  @apply active:scale-95 transition-transform;
  @apply text-base font-medium;
}

/* 하단 고정 버튼 (엄지손가락 도달 영역) */
.bottom-action-bar {
  @apply fixed bottom-0 left-0 right-0;
  @apply p-4 bg-white border-t;
  @apply safe-bottom; /* iOS Safe Area */
}
```

---

## 🎨 간결한 모바일 UI

### 메인 화면 (단일 플로우)
```
┌─────────────────────────┐
│  Image Composer         │
├─────────────────────────┤
│                         │
│  [📁 이미지 선택]        │
│                         │
│  ┌───┬───┬───┬───┐     │
│  │ 1 │ 2 │ 3 │ 4 │     │
│  │✓ │✓ │   │   │     │
│  └───┴───┴───┴───┘     │
│  2개 선택               │
│                         │
│  [프리셋]               │
│  ┌──────┬──────┐       │
│  │유튜브│하단  │       │
│  │자막  │30%  │       │
│  └──────┴──────┘       │
│                         │
│  [그룹]                 │
│  ┌────────────────┐    │
│  │큰자막 30% (1개)│    │
│  │[일괄 크롭]     │    │
│  └────────────────┘    │
│                         │
├─────────────────────────┤
│ [합성하기] [미리보기]   │
└─────────────────────────┘
```

### 네비게이션 (하단 탭)
```
┌─────────────────────────┐
│                         │
│   (컨텐츠 영역)         │
│                         │
├─────────────────────────┤
│ [이미지] [편집] [합성]  │
└─────────────────────────┘
```

---

## ⚡ 핵심 워크플로우

### 시나리오: 유튜브 자막 4장 처리

```typescript
// 1. 이미지 불러오기
const images = await loadImages(4);

// 2. 빠른 분류
const group1 = createGroup('큰 자막', 30);
assignImages(group1, [images[0]]);

const group2 = createGroup('작은 자막', 20);
assignImages(group2, [images[1], images[2], images[3]]);

// 3. 일괄 처리
await processGroup(group1);  // 1개
await processGroup(group2);  // 3개

// 4. 합성
const result = await compose();

// 5. 공유
await share(result);
```

**총 소요 시간: ~30초**

---

## 📊 개발 일정

| Phase | 내용 | 기간 |
|-------|------|------|
| 1 | 프로젝트 셋업 | 1-2일 |
| 2 | 이미지 입력 | 2-3일 |
| 3 | 프리셋 시스템 | 2-3일 |
| 4 | 그룹핑 시스템 | 3-4일 |
| 5 | 배치 크롭 | 3-4일 |
| 6 | 이미지 합성 | 3-4일 |
| 7 | 저장/공유 | 1-2일 |
| 8 | 최적화 & 테스트 | 2-3일 |

**총 예상: 2.5-3주**

---

## 🚀 우선순위

### 필수 (MVP)
- ✅ 이미지 불러오기 (갤러리)
- ✅ 기본 크롭
- ✅ 프리셋 3-4개
- ✅ 배치 크롭
- ✅ 세로 합성
- ✅ 저장/공유

### 중요
- ✅ 높이별 그룹
- ✅ 코멘트 추가
- ✅ 순서 변경 (드래그)
- ✅ 메모리 최적화

### 선택
- ⚪ 공유받기 (Share Target)
- ⚪ 프로젝트 저장
- ⚪ 다크 모드
- ⚪ 템플릿 시스템

---

## 💡 핵심 개발 팁

### 1. 모바일 터치 우선
```typescript
// 버튼: 최소 48x48px
// 간격: 8px 이상
// 폰트: 최소 16px (줌 방지)
```

### 2. 로딩 상태 명확히
```typescript
const [isProcessing, setIsProcessing] = useState(false);
const [progress, setProgress] = useState(0);

// 프로그레스 바 필수
if (isProcessing) {
  return <ProgressBar value={progress} />;
}
```

### 3. 에러 처리
```typescript
try {
  await processImage();
} catch (error) {
  showToast('이미지 처리 실패. 다시 시도해주세요.');
  console.error(error);
}
```

### 4. 성능 모니터링
```typescript
const startTime = performance.now();
await composeImages();
const duration = performance.now() - startTime;
console.log(`합성 시간: ${duration}ms`);
```

---

## 📦 배포

### Vercel (권장)
```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 배포
vercel

# 3. 프로덕션 배포
vercel --prod
```

### PWA 체크리스트
- [x] manifest.json
- [x] service-worker.js
- [x] HTTPS (Vercel 자동)
- [x] 192x192, 512x512 아이콘
- [x] 오프라인 fallback

---

## 🔗 참고 자료

- [React Image Crop](https://www.npmjs.com/package/react-image-crop)
- [Zustand](https://github.com/pmndrs/zustand)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

## 📞 문의 및 피드백

프로젝트 진행 중 궁금한 점이나 개선 아이디어가 있다면 언제든지 공유해주세요!

---

**마지막 업데이트: 2025-10-17**
