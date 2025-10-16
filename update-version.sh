#!/bin/bash

# PWA 버전 업데이트 스크립트
# 사용법: ./update-version.sh 1.0.1

if [ -z "$1" ]; then
    echo "❌ 버전을 입력하세요. 예: ./update-version.sh 1.0.1"
    exit 1
fi

NEW_VERSION=$1
echo "🔄 버전을 ${NEW_VERSION}로 업데이트합니다..."

# index.html 업데이트
sed -i "s/<title>Share PWA v[^<]*<\/title>/<title>Share PWA v${NEW_VERSION}<\/title>/" index.html
sed -i "s/manifest.json?v=[^\"]*/manifest.json?v=${NEW_VERSION}/" index.html
sed -i "s/<p style=\"font-size: 12px; color: #999; margin-top: 5px;\">v[^<]*<\/p>/<p style=\"font-size: 12px; color: #999; margin-top: 5px;\">v${NEW_VERSION}<\/p>/" index.html
sed -i "s/const APP_VERSION = '[^']*';/const APP_VERSION = '${NEW_VERSION}';/" index.html

# sw.js 업데이트
sed -i "s/const CACHE_NAME = 'share-pwa-v[^']*';/const CACHE_NAME = 'share-pwa-v${NEW_VERSION}';/" sw.js

echo "✅ 버전 업데이트 완료!"
echo ""
echo "변경된 파일:"
echo "  - index.html"
echo "  - sw.js"
echo ""
echo "다음 명령어로 커밋하세요:"
echo "  git add -A"
echo "  git commit -m \"Bump version to ${NEW_VERSION}\""
echo "  git push origin main"
