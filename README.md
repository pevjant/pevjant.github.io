# Share PWA v1.0.0

안드로이드에서 다른 앱의 콘텐츠를 이 PWA로 공유할 수 있는 Progressive Web App입니다.

## 🚀 기능

- ✅ 텍스트, URL, 이미지, 비디오, 오디오 파일 공유 지원
- ✅ 안드로이드 Share Target API 지원
- ✅ 오프라인 지원 (Service Worker)
- ✅ 홈 화면 설치 가능

## 📱 사용 방법

1. https://pevjant.github.io 접속
2. "홈 화면에 추가" 또는 "설치" 버튼 클릭
3. 다른 앱에서 콘텐츠를 공유할 때 "SharePWA" 선택

## 🔧 개발

### 버전 업데이트

```bash
# 버전 변경 (예: 1.0.0 -> 1.0.1)
./update-version.sh 1.0.1

# 변경사항 커밋 및 푸시
git add -A
git commit -m "Bump version to 1.0.1"
git push origin main
```

### 로컬 테스트

```bash
# Python 3
python3 -m http.server 8080

# 브라우저에서 접속
# http://localhost:8080
```

## 📂 파일 구조

```
.
├── index.html              # 메인 PWA 페이지
├── manifest.json           # PWA Manifest (Share Target 설정)
├── sw.js                   # Service Worker
├── test-share.html         # 테스트 페이지
├── update-version.sh       # 버전 업데이트 스크립트
├── TROUBLESHOOTING.md      # 문제 해결 가이드
└── icon-*.png              # PWA 아이콘
```

## 🐛 문제 해결

문제가 발생하면 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 파일을 참조하세요.

## 📝 버전 히스토리

### v1.0.0 (2025-10-16)
- 초기 릴리즈
- Share Target API 지원
- 이미지/비디오/오디오/텍스트 파일 공유 지원
- Service Worker 캐싱
- 버전 관리 시스템 추가