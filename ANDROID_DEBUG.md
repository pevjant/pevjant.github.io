# 🚨 안드로이드 공유 기능 작동 안 함 - 해결 가이드

## 📱 즉시 확인 사항

### 1단계: 진단 도구 실행 (필수!)
안드로이드 Chrome에서 이 URL을 열어주세요:
```
https://pevjant.github.io/diagnostic.html
```

이 페이지가 모든 문제를 자동으로 체크하고 해결 방법을 알려줍니다.

---

## 🔍 일반적인 원인과 해결 방법

### 원인 1: PWA가 제대로 설치되지 않음

**증상:**
- 홈 화면에 아이콘은 있지만 공유 메뉴에 안 보임
- "홈 화면에 추가"만 했고 "설치"는 안 함

**해결 방법:**
```
1. 안드로이드 홈 화면에서 PWA 아이콘 길게 누르기
2. "앱 정보" 선택
3. "제거" 또는 "삭제" (완전히 제거)
4. Chrome에서 https://pevjant.github.io 접속
5. 주소창 옆 "다운로드" 또는 "설치" 아이콘 클릭
   (메뉴 → "앱 설치" 또는 "홈 화면에 추가"가 아님!)
6. "설치" 버튼 클릭
```

**중요:** "홈 화면에 추가"와 "앱 설치"는 다릅니다!
- ❌ 홈 화면에 추가: 단순 북마크 (공유 타겟 X)
- ✅ 앱 설치: 실제 PWA 설치 (공유 타겟 O)

---

### 원인 2: Chrome 버전이 오래됨

**필요 버전:** Chrome 84 이상

**확인 방법:**
```
1. Chrome 앱 실행
2. 메뉴(⋮) → "설정"
3. "Chrome 정보" 클릭
4. 버전 확인
```

**해결 방법:**
- Play Store에서 Chrome 업데이트

---

### 원인 3: 캐시된 구버전 사용 중

**해결 방법:**
```
1. Chrome에서 https://pevjant.github.io 접속
2. 메뉴(⋮) → "설정"
3. "개인정보 보호 및 보안"
4. "인터넷 사용 기록 삭제"
5. "캐시된 이미지 및 파일" 체크
6. "데이터 삭제"
7. PWA 재설치
```

---

### 원인 4: 제조사 브라우저 사용

**증상:**
- Samsung Internet, LG Browser 등 사용 중

**해결 방법:**
- Google Chrome 사용 (필수)
- Chrome이 기본 브라우저여야 함

---

## 🛠️ 고급 디버깅 (Chrome DevTools)

### PC에서 안드로이드 원격 디버깅

#### 준비 사항:
1. 안드로이드 "개발자 옵션" 활성화
2. "USB 디버깅" 켜기
3. USB 케이블로 PC와 연결

#### 디버깅 단계:
```
1. PC Chrome에서 chrome://inspect 접속
2. 안드로이드에서 USB 디버깅 허용
3. "Devices" 탭에서 기기 확인
4. 안드로이드 Chrome에서 https://pevjant.github.io 열기
5. PC Chrome에서 해당 탭 옆 "inspect" 클릭
```

#### 확인할 것:
```javascript
// Console 탭에서 실행:

// 1. Manifest 확인
fetch('/manifest.json').then(r => r.json()).then(console.log)

// 2. Service Worker 확인
navigator.serviceWorker.getRegistration().then(console.log)

// 3. 설치 상태 확인
console.log('Standalone:', window.matchMedia('(display-mode: standalone)').matches)

// 4. 아이콘 확인
fetch('/icon-192x192.png').then(r => console.log('192:', r.ok))
fetch('/icon-512x512.png').then(r => console.log('512:', r.ok))
```

#### Application 탭 확인:
- **Manifest**: 모든 필드가 올바른지 확인
- **Service Workers**: "activated and is running" 상태인지 확인
- **Storage > Cache Storage**: 아이콘이 캐시되었는지 확인

---

## ✅ 정상 작동 확인 방법

### 1. 진단 도구에서 모두 ✓ 표시
```
https://pevjant.github.io/diagnostic.html
→ 모든 항목이 녹색 체크(✓)여야 함
```

### 2. Standalone 모드 확인
```
PWA 실행 → 주소창이 안 보임 (Standalone)
→ 정상 설치됨
```

### 3. 공유 메뉴 확인
```
갤러리 앱 → 이미지 선택 → 공유 버튼
→ "SharePWA" 또는 "My Share PWA" 보임
→ 정상 작동
```

---

## 🔧 여전히 안 되는 경우

### 체크리스트:

- [ ] Chrome 버전 84 이상
- [ ] HTTPS 사이트 (https://pevjant.github.io)
- [ ] PWA 완전히 삭제 후 재설치
- [ ] "앱 설치" 사용 ("홈 화면 추가" X)
- [ ] 진단 도구에서 모든 항목 ✓
- [ ] Chrome DevTools에서 에러 없음
- [ ] 안드로이드 기본 브라우저가 Chrome
- [ ] 캐시 삭제 후 재설치

### 추가 조치:

#### 1. 안드로이드 재부팅
```
기기 재부팅 후 PWA 재설치
```

#### 2. Chrome 데이터 완전 삭제
```
설정 → 앱 → Chrome → 저장공간 → "데이터 삭제"
(주의: 모든 Chrome 데이터 삭제됨)
```

#### 3. 다른 안드로이드 기기에서 테스트
```
친구/가족 기기에서 테스트하여 기기 문제인지 확인
```

---

## 📊 알려진 제한사항

### 지원하는 환경:
- ✅ Android 6.0+ (Chrome 84+)
- ✅ Chrome, Edge (Android)
- ✅ Samsung Internet 12+

### 지원하지 않는 환경:
- ❌ iOS (Safari) - Share Target API 미지원
- ❌ Android 5.x 이하
- ❌ Chrome 83 이하
- ❌ Firefox (Android) - 부분 지원

---

## 💡 최종 확인 절차

### 완전 초기화 후 재설치:

```bash
# 1. PWA 완전 삭제
홈 화면에서 앱 아이콘 → 앱 정보 → 제거

# 2. Chrome 캐시 삭제
Chrome → 설정 → 개인정보 보호 → 인터넷 사용 기록 삭제
→ 캐시된 이미지 및 파일 체크 → 삭제

# 3. Chrome 재시작
Chrome 완전 종료 후 재실행

# 4. 진단 도구 확인
https://pevjant.github.io/diagnostic.html
→ 모든 항목 확인

# 5. PWA 설치
https://pevjant.github.io
→ 주소창 옆 "설치" 아이콘 클릭
→ "설치" 버튼 클릭
→ 홈 화면에서 실행하여 Standalone 모드 확인

# 6. 공유 테스트
갤러리 → 이미지 선택 → 공유
→ "SharePWA" 선택
→ 이미지가 PWA에 표시되는지 확인
```

---

## 🆘 그래도 안 되면?

### Chrome DevTools 로그 캡처:

1. PC와 안드로이드 USB 연결
2. `chrome://inspect`에서 원격 디버깅
3. Console 탭의 모든 에러 메시지 복사
4. Application 탭 스크린샷
5. 이슈로 제보

### 필요한 정보:
- 안드로이드 버전
- Chrome 버전
- 기기 모델
- 진단 도구 결과 스크린샷
- DevTools 콘솔 에러

---

## 📱 성공 사례 체크리스트

정상 작동 시 다음이 모두 참이어야 합니다:

✅ `chrome://inspect`에서 Manifest 파싱 에러 없음
✅ Service Worker가 "activated and is running" 상태
✅ `/icon-192x192.png`, `/icon-512x512.png` 정상 로드 (200 OK)
✅ PWA 실행 시 주소창이 안 보임 (Standalone)
✅ `display-mode: standalone` 매칭됨
✅ 갤러리 공유 메뉴에 "SharePWA" 표시됨
✅ 이미지 선택 후 PWA에 표시됨

---

## 🔗 유용한 링크

- 진단 도구: https://pevjant.github.io/diagnostic.html
- 테스트 페이지: https://pevjant.github.io/test-share.html
- 메인 앱: https://pevjant.github.io
- 문제 해결 가이드: TROUBLESHOOTING.md

---

**마지막 업데이트:** 2025-10-16
**현재 버전:** v1.0.0
