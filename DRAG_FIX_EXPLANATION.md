# 🔧 드래그 문제 해결 방안

## 🐛 현재 문제

### 증상
1. **첫 입력 후 반응이 느림**
2. **마우스보다 크롭 영역이 더 많이 이동됨** (약 2배)

### 원인 분석

```javascript
// ❌ 현재 코드 (잘못됨)
const onPointerMove = (e) => {
    const dx = ((e.clientX - startX) / cachedRect.width) * 100;  // 항상 첫 위치부터 계산
    const dy = ((e.clientY - startY) / cachedRect.height) * 100;
    
    cropArea.x = startCropArea.x + dx;  // 누적 더하기
    // startX는 업데이트 안 됨 → dx가 계속 커짐!
}
```

#### 시나리오 예시:
```
Down 시점: clientX=100, startX=100, dx=0
Move 1:   clientX=110, startX=100, dx=10  → cropArea.x += 10
Move 2:   clientX=120, startX=100, dx=20  → cropArea.x += 20 (10 더해짐)
Move 3:   clientX=130, startX=100, dx=30  → cropArea.x += 30 (10 더해짐)
                                            총 이동: 60 (실제는 30이어야 함)
```

**결과**: 이동 거리가 **2배**로 증가!

---

## ✅ 해결 방법 2가지

### 방법 1: 증분 델타 (Incremental Delta)
```javascript
// 이전 프레임 위치 저장
let lastX = startX;
let lastY = startY;

const onPointerMove = (e) => {
    // 이전 위치부터의 변화량만 계산
    const dx = ((e.clientX - lastX) / cachedRect.width) * 100;
    const dy = ((e.clientY - lastY) / cachedRect.height) * 100;
    
    // 현재 값에서 델타만큼 이동
    cropArea.x += dx;
    cropArea.y += dy;
    
    // 다음 계산을 위해 업데이트
    lastX = e.clientX;
    lastY = e.clientY;
}
```

**장점**: 
- 간단하고 직관적
- 각 프레임의 이동량만 추적

**단점**: 
- 부동소수점 오차 누적 가능
- RAF 스킵 시 위치 오차 발생 가능

---

### 방법 2: 절대 위치 계산 (Absolute Position) ⭐ 권장
```javascript
const onPointerMove = (e) => {
    // 전체 이동 거리 계산
    const totalDx = ((e.clientX - startX) / cachedRect.width) * 100;
    const totalDy = ((e.clientY - startY) / cachedRect.height) * 100;
    
    // 시작 위치 기준으로 절대 위치 계산
    cropArea.x = startCropArea.x + totalDx;
    cropArea.y = startCropArea.y + totalDy;
    
    // startX, startY는 pointerdown 시점에만 설정, 변경 안 함
}
```

**장점**: 
- ✅ 정확함 (오차 누적 없음)
- ✅ RAF 스킵되어도 최종 위치 정확
- ✅ 현재 코드와 유사 (수정 최소)

**단점**: 
- 없음 (이게 정답!)

---

## 🎯 실제 문제 원인

현재 코드는 **방법 2를 의도했지만 잘못 구현**:

```javascript
// 현재 (의도는 맞음)
cropArea.x = startCropArea.x + dx;  // ✅ 절대 위치 계산 의도

// 하지만...
// startX, startY가 업데이트되지 않으므로
// dx는 항상 "처음부터 현재까지의 전체 거리"를 의미함 ✅

// 그런데 왜 2배로 움직이나?
// → startCropArea도 업데이트되고 있었나? (확인 필요)
```

### 🔍 실제 로그 분석

```
preview:down - startX: 545, startArea: {x: 0, y: 0, width: 100, height: 25}
preview:move - clientX: 513, dx: -31.72, calcX: -31.72
                                         ^^^^^^ 음수!
```

**발견!**: 
- startX=545인데 clientX=513이면 dx=-31.72 맞음
- 하지만 calcX=-31.72는 **cropArea.x가 음수**가 됨!
- Math.max(0, ...)로 0으로 보정되지만, 의도와 다름

---

## 🔧 올바른 수정

### 문제: cachedRect가 정확하지 않을 수 있음

```javascript
const startResize = (e) => {
    cachedRect = cropBox.getBoundingClientRect();  // cropBox의 위치
    // 하지만 계산은 img 기준으로 해야 함!
}
```

**해결책**: img의 getBoundingClientRect 사용

```javascript
const startResize = (e) => {
    cachedRect = img.getBoundingClientRect();  // ✅ img 기준
    startX = e.clientX;
    startY = e.clientY;
}
```

---

## 📋 적용 순서

1. ✅ **상세 로그 추가** (현재 단계)
   - clientX, startX, calcX 등 출력
   - 문제 원인 정확히 파악

2. ⏭️ **cachedRect 수정**
   - cropBox → img로 변경
   - 테스트

3. ⏭️ **필요시 증분 델타 방식으로 변경**
   - 여전히 문제 있으면 방법 1 적용

---

## 🧪 테스트 방법

1. `?debug=1` 파라미터로 접속
2. 크롭 영역 드래그/리사이즈
3. 콘솔 로그 확인:
   ```
   startX: 100
   clientX: 110
   dx: 10
   startArea.x: 50
   calcX: 60
   finalArea.x: 60  ← 이게 60이어야 정상
   ```

4. **확인 사항**:
   - dx가 예상과 맞는가?
   - calcX = startArea.x + dx 가 맞는가?
   - finalArea.x = calcX 인가? (Math.max/min 적용 전)

---

**다음 단계**: 로그 확인 후 정확한 수정 적용
