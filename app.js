// ===== 앱 버전 =====
const APP_VERSION = '2.10.0';

// ===== 디버그 유틸 =====
function isDebug() {
    try {
        return /(^|[?&])debug=1(&|$)/.test(location.search) || localStorage.getItem('DEBUG_DRAG') === '1';
    } catch {
        return false;
    }
}
function dlog(scope, ...args) {
    if (!isDebug()) return;
    console.log(`[${new Date().toISOString()}][${scope}]`, ...args);
}

// ===== Service Worker 등록 =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => {
            console.log('✅ SW registered');
            
            // 업데이트 체크
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                console.log('🔄 새로운 Service Worker 발견');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('🆕 새 버전 사용 가능 - 페이지를 새로고침하세요');
                        // 자동으로 새 버전 활성화
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });
            
            // 페이지 로드 시 업데이트 확인
            reg.update();
        })
        .catch(err => console.error('❌ SW error:', err));
    
    // Service Worker가 제어권을 가져가면 페이지 새로고침
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log('🔄 Service Worker 업데이트됨 - 페이지 새로고침');
            window.location.reload();
        }
    });
}

// ===== 공유 받기 처리 =====
// ===== 공유 받기 처리 =====
window.addEventListener('DOMContentLoaded', async () => {
    // 버전 표시
    document.getElementById('appVersion').textContent = `v${APP_VERSION}`;
    const url = new URL(window.location.href);
    
    if (url.searchParams.get('shared') === '1') {
        try {
            const cache = await caches.open('shared-data');
            const response = await cache.match('/shared-data/latest');
            
            if (response) {
                const data = await response.json();
                
                // 공유받은 이미지를 state에 추가
                if (data.files && data.files.length > 0) {
                    for (const fileData of data.files) {
                        try {
                            const fileCache = await caches.open('shared-files');
                            const fileResponse = await fileCache.match(fileData.url);
                            if (fileResponse) {
                                const blob = await fileResponse.blob();
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    state.images.push({
                                        id: generateId(),
                                        file: null,
                                        dataUrl: e.target.result,
                                        cropped: false,
                                        cropData: null,
                                        comment: ''
                                    });
                                    renderImageGallery();
                                };
                                reader.readAsDataURL(blob);
                            }
                        } catch (err) {
                            console.error('파일 로드 실패:', err);
                        }
                    }
                    showToast(`${data.files.length}개 이미지 받음 📥`);
                }
                
                await cache.delete('/shared-data/latest');
                window.history.replaceState({}, '', '/app.html');
            }
        } catch (error) {
            console.error('공유 로드 실패:', error);
        }
    }
});

// ===== 상태 관리 =====
const state = {
    images: [],
    selectedImages: [],
    currentCropImage: null,
    currentPreset: null,
    croppedImages: [],
    resultImage: null,
    customCropPresets: [] // 사용자 정의 프리셋 저장
};

// ===== 프리셋 로컬스토리지 관리 =====
function loadCustomPresets() {
    try {
        const saved = localStorage.getItem('customCropPresets');
        if (saved) {
            state.customCropPresets = JSON.parse(saved);
        }
    } catch (e) {
        console.error('프리셋 로드 실패:', e);
    }
}

function saveCustomPreset(name, area) {
    const preset = {
        id: generateId(),
        name: name,
        area: { ...area },
        createdAt: Date.now()
    };
    state.customCropPresets.push(preset);
    localStorage.setItem('customCropPresets', JSON.stringify(state.customCropPresets));
    return preset;
}

function deleteCustomPreset(id) {
    state.customCropPresets = state.customCropPresets.filter(p => p.id !== id);
    localStorage.setItem('customCropPresets', JSON.stringify(state.customCropPresets));
}

// ===== 초기 프리셋 로드 =====
loadCustomPresets();

// ===== 유틸리티 함수 =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
    });
}

// ===== 탭 전환 =====
function switchTab(tab) {
    // 탭 버튼 업데이트
    ['input', 'edit', 'compose'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`content-${t}`);
        if (t === tab) {
            btn.className = 'flex-1 py-3 font-medium border-b-2 border-blue-500 text-blue-500';
            content.classList.remove('hidden');
        } else {
            btn.className = 'flex-1 py-3 font-medium border-b-2 border-transparent text-gray-500';
            content.classList.add('hidden');
        }
    });

    // 편집 탭 진입시 업데이트
    if (tab === 'edit') {
        updateEditTab();
    }
    // 합성 탭 진입시 업데이트
    if (tab === 'compose') {
        // 크롭 편집기가 열려있으면 닫기
        if (state.currentCropImage && !document.getElementById('cropEditor').classList.contains('hidden')) {
            // 이미 열려있으면 유지
        } else {
            state.currentCropImage = null;
        }
        updateComposeTab();
    }
}

// ===== 이미지 입력 =====
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

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
    e.target.value = ''; // 리셋하여 같은 파일 재선택 가능
});

function renderImageGallery() {
    const gallery = document.getElementById('imageGallery');
    if (state.images.length === 0) {
        gallery.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-2">이미지를 선택해주세요</p>';
        return;
    }

    gallery.innerHTML = state.images.map((img, idx) => `
        <div class="relative border rounded-lg overflow-hidden image-card">
            <img src="${img.dataUrl}" class="w-full h-32 object-cover">
            <div class="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                ${idx + 1}
            </div>
            ${img.cropped ? '<div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">✓</div>' : ''}
            <div class="p-2 bg-white">
                <button onclick="deleteImage('${img.id}')" 
                        class="w-full py-1 text-sm bg-red-500 text-white rounded active:bg-red-600">
                    삭제
                </button>
            </div>
        </div>
    `).join('');
}

function toggleImageSelection(id) {
    const idx = state.selectedImages.indexOf(id);
    if (idx > -1) {
        state.selectedImages.splice(idx, 1);
    } else {
        state.selectedImages.push(id);
    }
    renderImageGallery();
}

function deleteImage(id) {
    if (confirm('이미지를 삭제하시겠습니까?')) {
        state.images = state.images.filter(img => img.id !== id);
        state.selectedImages = state.selectedImages.filter(sid => sid !== id);
        renderImageGallery();
        showToast('이미지 삭제됨');
    }
}

// ===== 편집 탭 =====
function updateEditTab() {
    // 기존 드래그 이벤트 정리
    if (previewDragCleanup) {
        previewDragCleanup();
        previewDragCleanup = null;
    }
    
    // 대표 이미지 미리보기
    const previewContainer = document.getElementById('cropPreview');
    if (state.images.length > 0) {
        const firstImage = state.images[0];
        previewContainer.innerHTML = `
            <div class="relative inline-block w-full">
                <img src="${firstImage.dataUrl}" class="w-full rounded-lg shadow">
                <div class="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    대표 이미지 (1/${state.images.length})
                </div>
                <div id="previewCropOverlay" class="absolute top-0 left-0 w-full h-full pointer-events-none"></div>
            </div>
        `;
        updatePreviewCropArea();
    } else {
        previewContainer.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <div class="text-4xl mb-2">🖼️</div>
                <div>이미지를 먼저 선택해주세요</div>
            </div>
        `;
    }

    // 저장된 프리셋 목록
    renderSavedPresets();

    // 이미지 개수 업데이트
    const imageCount = document.getElementById('imageCount');
    imageCount.textContent = state.images.length;

    // 크롭 버튼 활성화 상태
    const cropButton = document.getElementById('batchCropButton');
    cropButton.disabled = state.images.length === 0;
}

function renderSavedPresets() {
    const container = document.getElementById('savedPresets');
    if (state.customCropPresets.length === 0) {
        container.innerHTML = '<div class="text-sm text-gray-400 text-center py-2">저장된 프리셋이 없습니다</div>';
        return;
    }

    container.innerHTML = state.customCropPresets.map(preset => `
        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border">
            <button onclick="loadPreset('${preset.id}')" class="flex-1 text-left text-sm font-medium text-blue-600">
                ${preset.name}
            </button>
            <button onclick="deletePreset('${preset.id}')" class="text-red-500 text-xs px-2 py-1 hover:bg-red-50 rounded">
                삭제
            </button>
        </div>
    `).join('');
}

function loadPreset(id) {
    const preset = state.customCropPresets.find(p => p.id === id);
    if (preset) {
        cropArea = { ...preset.area };
        updateCropInputs();
        updatePreviewCropArea();
        showToast(`"${preset.name}" 프리셋 로드됨`);
    }
}

function deletePreset(id) {
    const preset = state.customCropPresets.find(p => p.id === id);
    if (preset && confirm(`"${preset.name}" 프리셋을 삭제하시겠습니까?`)) {
        deleteCustomPreset(id);
        renderSavedPresets();
        showToast('프리셋 삭제됨');
    }
}

function updateCropInputs() {
    document.getElementById('cropTop').value = Math.round(cropArea.y);
    document.getElementById('cropBottom').value = Math.round(100 - cropArea.y - cropArea.height);
    document.getElementById('cropLeft').value = Math.round(cropArea.x);
    document.getElementById('cropRight').value = Math.round(100 - cropArea.x - cropArea.width);
    
    document.getElementById('rangeTop').value = Math.round(cropArea.y);
    document.getElementById('rangeBottom').value = Math.round(100 - cropArea.y - cropArea.height);
    document.getElementById('rangeLeft').value = Math.round(cropArea.x);
    document.getElementById('rangeRight').value = Math.round(100 - cropArea.x - cropArea.width);
}

// 드래그 이벤트 정리용
let previewDragCleanup = null;

function updatePreviewCropArea() {
    const overlay = document.getElementById('previewCropOverlay');
    if (!overlay) return;
    
    // 기존 이벤트 정리
    if (previewDragCleanup) {
        previewDragCleanup();
        previewDragCleanup = null;
    }
    
    overlay.innerHTML = `
        <div class="crop-area pointer-events-auto" id="previewCropBox" style="
            left: ${cropArea.x}%;
            top: ${cropArea.y}%;
            width: ${cropArea.width}%;
            height: ${cropArea.height}%;
        ">
            <div class="resize-handle handle-se"></div>
        </div>
    `;
    
    setupPreviewDrag();
}

function setupPreviewDrag() {
    const cropBox = document.getElementById('previewCropBox');
    const resizeHandle = cropBox?.querySelector('.resize-handle');
    const overlay = document.getElementById('previewCropOverlay');
    const img = overlay?.previousElementSibling;

    if (!cropBox || !img) return;

    // 보장: 터치 제스처/텍스트 선택 방지
    cropBox.style.touchAction = 'none';
    cropBox.style.userSelect = 'none';
    if (resizeHandle) {
        resizeHandle.style.touchAction = 'none';
        resizeHandle.style.userSelect = 'none';
    }

    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startCropArea = null;
    let cachedRect = null;
    let rafId = null;
    let pointerId = null;
    const dbg = {
        scope: 'preview',
        type: '',
        startTs: 0,
        firstMoveTs: 0,
        lastMoveTs: 0,
        lastRenderTs: 0,
        moveCount: 0,
        renderCount: 0,
        lastLogTs: 0,
        startScrollY: 0,
        lastCoalesced: 0,
    };

    const applyBoxStyles = () => {
        cropBox.style.left = cropArea.x + '%';
        cropBox.style.top = cropArea.y + '%';
        cropBox.style.width = cropArea.width + '%';
        cropBox.style.height = cropArea.height + '%';
    };
    const render = (finalize = false) => {
        // 입력 값 업데이트 (매 프레임)
        updateCropInputs();
        dbg.renderCount++;
        const now = performance.now();
        dbg.lastRenderTs = now;
        const latency = dbg.lastRenderTs - dbg.lastMoveTs;
        if (isDebug() && (finalize || latency > 50)) {
            dlog(`${dbg.scope}:render`, { finalize, latency: Math.round(latency), moveCount: dbg.moveCount, renderCount: dbg.renderCount });
        }
        rafId = null;
    };

    const onPointerMove = (e) => {
        if (!e.isPrimary || (!isDragging && !isResizing)) return;

        // 마지막 이벤트만 처리 (coalesced는 디버깅용으로만 사용)
        // 절대 좌표를 overlay 기준 상대 좌표로 변환
        const currentX = e.clientX - cachedRect.left;
        const currentY = e.clientY - cachedRect.top;
        const prevX = startX - cachedRect.left;
        const prevY = startY - cachedRect.top;
        const dx = ((currentX - prevX) / cachedRect.width) * 100;
        const dy = ((currentY - prevY) / cachedRect.height) * 100;

        if (isDragging) {
            cropArea.x = Math.max(0, Math.min(100 - startCropArea.width, startCropArea.x + dx));
            cropArea.y = Math.max(0, Math.min(100 - startCropArea.height, startCropArea.y + dy));
        } else if (isResizing) {
            cropArea.width = Math.max(10, Math.min(100 - startCropArea.x, startCropArea.width + dx));
            cropArea.height = Math.max(10, Math.min(100 - startCropArea.y, startCropArea.height + dy));
        }

        // 스타일은 즉시 반영해 첫 프레임 지연 제거
        applyBoxStyles();

        // 디버깅: 이동 이벤트 통계
        dbg.moveCount++;
        const now = performance.now();
        if (!dbg.firstMoveTs) dbg.firstMoveTs = now;
        dbg.lastMoveTs = now;
        if (isDebug() && (now - dbg.lastLogTs > 200 || dbg.moveCount <= 5)) {
            const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents().length : 0;
            dbg.lastCoalesced = coalesced;
            dlog(`${dbg.scope}:move`, {
                type: dbg.type,
                // 🔍 상세 디버깅
                clientX: e.clientX, clientY: e.clientY,
                startX, startY,
                rectW: cachedRect.width, rectH: cachedRect.height,
                dx: +dx.toFixed(2), dy: +dy.toFixed(2),
                startArea: { ...startCropArea },
                calcX: +(startCropArea.x + dx).toFixed(2),
                calcY: +(startCropArea.y + dy).toFixed(2),
                calcW: +(startCropArea.width + dx).toFixed(2),
                calcH: +(startCropArea.height + dy).toFixed(2),
                finalArea: { ...cropArea },
                rafPending: !!rafId,
                coalesced,
                scrollDY: window.scrollY - dbg.startScrollY,
            });
            dbg.lastLogTs = now;
        }

        // 입력 UI만 가볍게 스로틀 반영
        if (!rafId) rafId = requestAnimationFrame(() => render(false));
    };

    const onPointerUp = (e) => {
        if (!e.isPrimary || e.pointerId !== pointerId) return;
        isDragging = false;
        isResizing = false;
        startCropArea = null;
        pointerId = null;
        try { cropBox.releasePointerCapture(e.pointerId); } catch {}
        // 최종 입력값 반영
        if (!rafId) rafId = requestAnimationFrame(() => render(true));
        if (isDebug()) {
            const total = performance.now() - dbg.startTs;
            dlog(`${dbg.scope}:up`, {
                type: dbg.type,
                duration: Math.round(total),
                moves: dbg.moveCount,
                renders: dbg.renderCount,
                firstMoveDelay: Math.round((dbg.firstMoveTs || dbg.startTs) - dbg.startTs),
                lastLatency: Math.round(dbg.lastRenderTs - dbg.lastMoveTs),
                lastCoalesced: dbg.lastCoalesced,
                finalArea: { ...cropArea },
            });
        }
    };

    const startMove = (e) => {
        if (e.button !== undefined && e.button !== 0) return; // 좌클릭만
        if (e.target !== cropBox) return;
        isDragging = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startCropArea = { ...cropArea };
        cachedRect = overlay.getBoundingClientRect();
        try { cropBox.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    // 디버그 카운터 초기화
    dbg.type = 'move';
    dbg.startTs = performance.now();
    dbg.firstMoveTs = 0;
    dbg.lastMoveTs = 0;
    dbg.lastRenderTs = 0;
    dbg.moveCount = 0;
    dbg.renderCount = 0;
    dbg.lastLogTs = 0;
    dbg.startScrollY = window.scrollY;
        dlog(`${dbg.scope}:down`, {
            type: dbg.type,
            pid: e.pointerId,
            primary: e.isPrimary,
            pType: e.pointerType,
            x: e.clientX, y: e.clientY,
            rect: { w: cachedRect.width, h: cachedRect.height, l: cachedRect.left, t: cachedRect.top },
            area: { ...startCropArea },
        });
    };

    const startResize = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        isResizing = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startCropArea = { ...cropArea };
        cachedRect = overlay.getBoundingClientRect();
        try { cropBox.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        e.stopPropagation();
    // 디버그 카운터 초기화
    dbg.type = 'resize';
    dbg.startTs = performance.now();
    dbg.firstMoveTs = 0;
    dbg.lastMoveTs = 0;
    dbg.lastRenderTs = 0;
    dbg.moveCount = 0;
    dbg.renderCount = 0;
    dbg.lastLogTs = 0;
    dbg.startScrollY = window.scrollY;
        dlog(`${dbg.scope}:down`, {
            type: dbg.type,
            pid: e.pointerId,
            primary: e.isPrimary,
            pType: e.pointerType,
            x: e.clientX, y: e.clientY,
            rect: { w: cachedRect.width, h: cachedRect.height, l: cachedRect.left, t: cachedRect.top },
            area: { ...startCropArea },
        });
    };

    // Pointer Events 등록 (단일 경로)
    cropBox.addEventListener('pointerdown', startMove);
    cropBox.addEventListener('pointermove', onPointerMove);
    cropBox.addEventListener('pointerup', onPointerUp);
    cropBox.addEventListener('pointercancel', onPointerUp);
    if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', startResize);
    }

    // cleanup
    previewDragCleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        cropBox.removeEventListener('pointerdown', startMove);
        cropBox.removeEventListener('pointermove', onPointerMove);
        cropBox.removeEventListener('pointerup', onPointerUp);
        cropBox.removeEventListener('pointercancel', onPointerUp);
        if (resizeHandle) resizeHandle.removeEventListener('pointerdown', startResize);
    };
}

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

function saveCurrentPreset() {
    const name = prompt('프리셋 이름을 입력하세요:');
    if (name && name.trim()) {
        saveCustomPreset(name.trim(), cropArea);
        renderSavedPresets();
        showToast('프리셋 저장됨 ✓');
    }
}

// ===== 배치 크롭 =====
async function startBatchCrop() {
    if (state.images.length === 0) {
        showToast('이미지를 먼저 선택해주세요');
        return;
    }

    const button = document.getElementById('batchCropButton');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    button.disabled = true;
    progressBar.classList.remove('hidden');

    const total = state.images.length;
    const area = { ...cropArea }; // 현재 크롭 영역 사용

    for (let i = 0; i < total; i++) {
        const img = state.images[i];
        
        const croppedDataUrl = await cropImage(img.dataUrl, area);
        img.cropped = true;
        img.cropData = {
            dataUrl: croppedDataUrl,
            area: { ...area }
        };
        img.comment = ''; // 초기 코멘트 비움

        const progress = ((i + 1) / total) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }

    showToast(`${total}개 이미지 크롭 완료`);
    button.disabled = false;
    progressBar.classList.add('hidden');
    renderImageGallery();
    
    // 합성 탭으로 자동 이동
    switchTab('compose');
}

// ===== 크롭 편집기 (합성 탭에서 개별 수정용) =====
let cropArea = { x: 0, y: 0, width: 100, height: 25 }; // 기본값: 상단 25%

function showCropEditor() {
    document.getElementById('cropEditor').classList.remove('hidden');
    
    // 페이지 스크롤 방지
    document.body.classList.add('crop-editing');
    
    const img = state.currentCropImage;
    const cropImage = document.getElementById('cropImage');
    cropImage.src = img.dataUrl;
    
    // 기존 크롭 데이터가 있으면 사용
    if (img.cropData) {
        cropArea = { ...img.cropData.area };
        document.getElementById('commentInput').value = img.comment || '';
    }

    cropImage.onload = () => {
        updateEditCropInputs();
        renderCropOverlay();
    };
}

function updateEditCropInputs() {
    const top = Math.round(cropArea.y);
    const bottom = Math.round(100 - cropArea.y - cropArea.height);
    const left = Math.round(cropArea.x);
    const right = Math.round(100 - cropArea.x - cropArea.width);
    
    document.getElementById('editRangeTop').value = top;
    document.getElementById('editRangeBottom').value = bottom;
    document.getElementById('editRangeLeft').value = left;
    document.getElementById('editRangeRight').value = right;
}

function updateEditCropArea(side, value) {
    const val = parseInt(value) || 0;
    
    switch(side) {
        case 'top':
            const oldBottom = 100 - cropArea.y - cropArea.height;
            cropArea.y = val;
            cropArea.height = Math.max(1, 100 - val - oldBottom);
            break;
        case 'bottom':
            cropArea.height = Math.max(1, 100 - cropArea.y - val);
            break;
        case 'left':
            const oldRight = 100 - cropArea.x - cropArea.width;
            cropArea.x = val;
            cropArea.width = Math.max(1, 100 - val - oldRight);
            break;
        case 'right':
            cropArea.width = Math.max(1, 100 - cropArea.x - val);
            break;
    }
    
    updateEditCropInputs();
    renderCropOverlay();
}

function hideCropEditor() {
    document.getElementById('cropEditor').classList.add('hidden');
    state.currentCropImage = null;
    
    // 페이지 스크롤 복원
    document.body.classList.remove('crop-editing');
    
    // 드래그 이벤트 정리
    if (editDragCleanup) {
        editDragCleanup();
        editDragCleanup = null;
    }
}

function cancelCrop() {
    hideCropEditor();
    updateComposeTab(); // 합성 탭 새로고침
}

// 합성 탭 드래그 이벤트 정리용
let editDragCleanup = null;

function renderCropOverlay() {
    const overlay = document.getElementById('cropOverlay');
    if (!overlay) return;
    
    // 기존 이벤트 정리
    if (editDragCleanup) {
        editDragCleanup();
        editDragCleanup = null;
    }
    
    overlay.innerHTML = `
        <div class="crop-area pointer-events-auto" id="editCropBox" style="
            left: ${cropArea.x}%;
            top: ${cropArea.y}%;
            width: ${cropArea.width}%;
            height: ${cropArea.height}%;
        ">
            <div class="resize-handle handle-se"></div>
        </div>
    `;
    
    setupEditDrag();
}

function setupEditDrag() {
    const cropBox = document.getElementById('editCropBox');
    const resizeHandle = cropBox?.querySelector('.resize-handle');
    const overlay = document.getElementById('cropOverlay');
    const img = document.getElementById('cropImage');

    if (!cropBox || !img) return;

    cropBox.style.touchAction = 'none';
    cropBox.style.userSelect = 'none';
    if (resizeHandle) {
        resizeHandle.style.touchAction = 'none';
        resizeHandle.style.userSelect = 'none';
    }

    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startCropArea = null;
    let cachedRect = null;
    let rafId = null;
    let pointerId = null;
    const dbg = {
        scope: 'edit',
        type: '',
        startTs: 0,
        firstMoveTs: 0,
        lastMoveTs: 0,
        lastRenderTs: 0,
        moveCount: 0,
        renderCount: 0,
        lastLogTs: 0,
        startScrollY: 0,
        lastCoalesced: 0,
    };

    const applyBoxStyles = () => {
        cropBox.style.left = cropArea.x + '%';
        cropBox.style.top = cropArea.y + '%';
        cropBox.style.width = cropArea.width + '%';
        cropBox.style.height = cropArea.height + '%';
    };
    const render = (finalize = false) => {
        // 입력 값 업데이트 (매 프레임)
        updateEditCropInputs();
        dbg.renderCount++;
        const now = performance.now();
        dbg.lastRenderTs = now;
        const latency = dbg.lastRenderTs - dbg.lastMoveTs;
        if (isDebug() && (finalize || latency > 50)) {
            dlog(`${dbg.scope}:render`, { finalize, latency: Math.round(latency), moveCount: dbg.moveCount, renderCount: dbg.renderCount });
        }
        rafId = null;
    };

    const onPointerMove = (e) => {
        if (!e.isPrimary || (!isDragging && !isResizing)) return;

        // 절대 좌표를 overlay 기준 상대 좌표로 변환
        const currentX = e.clientX - cachedRect.left;
        const currentY = e.clientY - cachedRect.top;
        const prevX = startX - cachedRect.left;
        const prevY = startY - cachedRect.top;
        const dx = ((currentX - prevX) / cachedRect.width) * 100;
        const dy = ((currentY - prevY) / cachedRect.height) * 100;

        if (isDragging) {
            cropArea.x = Math.max(0, Math.min(100 - startCropArea.width, startCropArea.x + dx));
            cropArea.y = Math.max(0, Math.min(100 - startCropArea.height, startCropArea.y + dy));
        } else if (isResizing) {
            cropArea.width = Math.max(10, Math.min(100 - startCropArea.x, startCropArea.width + dx));
            cropArea.height = Math.max(10, Math.min(100 - startCropArea.y, startCropArea.height + dy));
        }

        // 스타일 즉시 반영
        applyBoxStyles();

        // 디버깅: 이동 이벤트 통계
        dbg.moveCount++;
        const now = performance.now();
        if (!dbg.firstMoveTs) dbg.firstMoveTs = now;
        dbg.lastMoveTs = now;
        if (isDebug() && (now - dbg.lastLogTs > 200 || dbg.moveCount <= 5)) {
            const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents().length : 0;
            dbg.lastCoalesced = coalesced;
            dlog(`${dbg.scope}:move`, {
                type: dbg.type,
                // 🔍 상세 디버깅
                clientX: e.clientX, clientY: e.clientY,
                startX, startY,
                rectW: cachedRect.width, rectH: cachedRect.height,
                dx: +dx.toFixed(2), dy: +dy.toFixed(2),
                startArea: { ...startCropArea },
                calcX: +(startCropArea.x + dx).toFixed(2),
                calcY: +(startCropArea.y + dy).toFixed(2),
                calcW: +(startCropArea.width + dx).toFixed(2),
                calcH: +(startCropArea.height + dy).toFixed(2),
                finalArea: { ...cropArea },
                rafPending: !!rafId,
                coalesced,
                scrollDY: window.scrollY - dbg.startScrollY,
            });
            dbg.lastLogTs = now;
        }

        if (!rafId) rafId = requestAnimationFrame(() => render(false));
    };

    const onPointerUp = (e) => {
        if (!e.isPrimary || e.pointerId !== pointerId) return;
        isDragging = false;
        isResizing = false;
        startCropArea = null;
        pointerId = null;
        try { cropBox.releasePointerCapture(e.pointerId); } catch {}
        if (!rafId) rafId = requestAnimationFrame(() => render(true));
        if (isDebug()) {
            const total = performance.now() - dbg.startTs;
            dlog(`${dbg.scope}:up`, {
                type: dbg.type,
                duration: Math.round(total),
                moves: dbg.moveCount,
                renders: dbg.renderCount,
                firstMoveDelay: Math.round((dbg.firstMoveTs || dbg.startTs) - dbg.startTs),
                lastLatency: Math.round(dbg.lastRenderTs - dbg.lastMoveTs),
                lastCoalesced: dbg.lastCoalesced,
                finalArea: { ...cropArea },
            });
        }
    };

    const startMove = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target !== cropBox) return;
        isDragging = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startCropArea = { ...cropArea };
        cachedRect = overlay.getBoundingClientRect();
        try { cropBox.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    // 디버그 카운터 초기화
    dbg.type = 'move';
    dbg.startTs = performance.now();
    dbg.firstMoveTs = 0;
    dbg.lastMoveTs = 0;
    dbg.lastRenderTs = 0;
    dbg.moveCount = 0;
    dbg.renderCount = 0;
    dbg.lastLogTs = 0;
    dbg.startScrollY = window.scrollY;
        dlog(`${dbg.scope}:down`, {
            type: dbg.type,
            pid: e.pointerId,
            primary: e.isPrimary,
            pType: e.pointerType,
            x: e.clientX, y: e.clientY,
            rect: { w: cachedRect.width, h: cachedRect.height, l: cachedRect.left, t: cachedRect.top },
            area: { ...startCropArea },
        });
    };

    const startResize = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        isResizing = true;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startCropArea = { ...cropArea };
        cachedRect = overlay.getBoundingClientRect();
        try { cropBox.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        e.stopPropagation();
    // 디버그 카운터 초기화
    dbg.type = 'resize';
    dbg.startTs = performance.now();
    dbg.firstMoveTs = 0;
    dbg.lastMoveTs = 0;
    dbg.lastRenderTs = 0;
    dbg.moveCount = 0;
    dbg.renderCount = 0;
    dbg.lastLogTs = 0;
    dbg.startScrollY = window.scrollY;
        dlog(`${dbg.scope}:down`, {
            type: dbg.type,
            pid: e.pointerId,
            primary: e.isPrimary,
            pType: e.pointerType,
            x: e.clientX, y: e.clientY,
            rect: { w: cachedRect.width, h: cachedRect.height, l: cachedRect.left, t: cachedRect.top },
            area: { ...startCropArea },
        });
    };

    cropBox.addEventListener('pointerdown', startMove);
    cropBox.addEventListener('pointermove', onPointerMove);
    cropBox.addEventListener('pointerup', onPointerUp);
    cropBox.addEventListener('pointercancel', onPointerUp);
    if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', startResize);
    }

    editDragCleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        cropBox.removeEventListener('pointerdown', startMove);
        cropBox.removeEventListener('pointermove', onPointerMove);
        cropBox.removeEventListener('pointerup', onPointerUp);
        cropBox.removeEventListener('pointercancel', onPointerUp);
        if (resizeHandle) resizeHandle.removeEventListener('pointerdown', startResize);
    };
}

async function applyCrop() {
    const img = state.currentCropImage;
    const comment = document.getElementById('commentInput').value;
    
    const croppedDataUrl = await cropImage(img.dataUrl, cropArea);
    
    img.cropped = true;
    img.cropData = {
        dataUrl: croppedDataUrl,
        area: { ...cropArea }
    };
    img.comment = comment;

    showToast('크롭 적용됨');
    hideCropEditor();
    renderImageGallery();
    updateComposeTab(); // 합성 탭 새로고침
}

// ===== 배치 크롭 제거 (더 이상 사용 안함) =====

// ===== 크롭 함수 =====
async function cropImage(dataUrl, area) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const x = (area.x / 100) * img.width;
            const y = (area.y / 100) * img.height;
            const width = (area.width / 100) * img.width;
            const height = (area.height / 100) * img.height;

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.90));
        };
        img.src = dataUrl;
    });
}

// ===== 합성 탭 =====
function updateComposeTab() {
    const croppedImages = state.images.filter(img => img.cropped);
    const count = document.getElementById('croppedCount');
    const preview = document.getElementById('croppedPreview');
    const composeButton = document.getElementById('composeButton');

    count.textContent = croppedImages.length;
    composeButton.disabled = croppedImages.length === 0;

    // 크롭 편집기가 열려있으면 숨김
    if (croppedImages.length === 0 || state.currentCropImage) {
        preview.innerHTML = '';
        return;
    }

    // 크롭된 이미지들을 세로로 미리보기
    preview.innerHTML = croppedImages.map((img, idx) => `
        <div class="border rounded-lg overflow-hidden mb-3">
            <div class="relative">
                <img src="${img.cropData.dataUrl}" class="w-full">
                <div class="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    ${idx + 1}
                </div>
            </div>
            <div class="p-3 bg-gray-50 space-y-2">
                <input type="text" 
                       id="comment-${img.id}" 
                       value="${img.comment || ''}" 
                       placeholder="코멘트 입력..."
                       oninput="updateComment('${img.id}', this.value)"
                       class="w-full p-2 text-sm border rounded-lg focus:border-blue-500 focus:outline-none">
                <button onclick="editCroppedImage('${img.id}')" 
                        class="w-full py-2 text-sm bg-blue-500 text-white rounded active:bg-blue-600">
                    ✏️ 크롭 영역 수정
                </button>
            </div>
        </div>
    `).join('');
}

function updateComment(id, comment) {
    const img = state.images.find(i => i.id === id);
    if (img) {
        img.comment = comment;
    }
}

function editCroppedImage(id) {
    state.currentCropImage = state.images.find(img => img.id === id);
    showCropEditor();
}

async function composeImages() {
    const croppedImages = state.images.filter(img => img.cropped);
    if (croppedImages.length === 0) {
        showToast('크롭된 이미지가 없습니다');
        return;
    }

    showToast('합성 중...');
    const composeButton = document.getElementById('composeButton');
    composeButton.disabled = true;
    composeButton.textContent = '🎨 합성 중...';

    const maxWidth = parseInt(document.getElementById('maxWidth').value) || 1080;
    const padding = parseInt(document.getElementById('padding').value) || 10;

    // 전체 높이 계산
    let totalHeight = padding;
    const imageHeights = [];

    for (const img of croppedImages) {
        const image = await loadImage(img.cropData.dataUrl);
        const height = (maxWidth / image.width) * image.height;
        imageHeights.push(height);
        totalHeight += height + padding;

        if (img.comment) {
            totalHeight += 60 + padding; // 코멘트 공간
        }
    }

    // Canvas 생성
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 이미지와 코멘트 배치
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
    
    composeButton.disabled = false;
    composeButton.textContent = '🎨 이미지 합성하기';
    showToast('합성 완료!');
}

// ===== 저장 및 공유 =====
function downloadResult() {
    const link = document.createElement('a');
    link.download = `composed-${Date.now()}.png`;
    link.href = state.resultImage;
    link.click();
    showToast('이미지 저장됨');
}

async function shareResult() {
    try {
        const blob = await (await fetch(state.resultImage)).blob();
        const file = new File([blob], 'composed-image.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: '합성 이미지',
                text: '이미지 확인해주세요'
            });
            showToast('공유됨');
        } else {
            downloadResult();
        }
    } catch (error) {
        console.error('Share failed:', error);
        downloadResult();
    }
}

// ===== 초기화 =====
renderImageGallery();
