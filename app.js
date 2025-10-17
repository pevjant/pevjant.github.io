// ===== Service Worker 등록 =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.error('SW error:', err));
}

// ===== 공유 받기 처리 =====
// ===== 공유 받기 처리 =====
window.addEventListener('DOMContentLoaded', async () => {
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
    resultImage: null
};

// ===== 프리셋 정의 =====
const presets = [
    { id: 'youtube-sub', name: '유튜브 자막', y: 75, height: 25, color: '#FF0000' },
    { id: 'bottom-30', name: '하단 30%', y: 70, height: 30, color: '#4A90E2' },
    { id: 'bottom-20', name: '하단 20%', y: 80, height: 20, color: '#50C878' },
    { id: 'full', name: '전체', y: 0, height: 100, color: '#9B59B6' }
];

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
                <label class="flex items-center text-sm">
                    <input type="checkbox" class="mr-2" ${state.selectedImages.includes(img.id) ? 'checked' : ''}
                           onchange="toggleImageSelection('${img.id}')">
                    선택
                </label>
                <button onclick="editImage('${img.id}')" 
                        class="mt-1 w-full py-1 text-sm bg-blue-500 text-white rounded active:bg-blue-600">
                    편집
                </button>
                <button onclick="deleteImage('${img.id}')" 
                        class="mt-1 w-full py-1 text-sm bg-red-500 text-white rounded active:bg-red-600">
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

function editImage(id) {
    state.currentCropImage = state.images.find(img => img.id === id);
    switchTab('edit');
    showCropEditor();
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
    // 프리셋 버튼 렌더링
    const presetButtons = document.getElementById('presetButtons');
    presetButtons.innerHTML = presets.map(preset => `
        <button onclick="selectPreset('${preset.id}')" 
                class="p-4 border-2 rounded-lg active:bg-gray-100 ${state.currentPreset?.id === preset.id ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}">
            <div class="font-medium">${preset.name}</div>
            <div class="text-sm text-gray-500">${preset.height}% 높이</div>
            <div class="mt-2 h-2 rounded" style="background: ${preset.color}"></div>
        </button>
    `).join('');

    // 선택 정보 업데이트
    const selectedInfo = document.getElementById('selectedInfo');
    const selectedCount = document.getElementById('selectedCount');
    if (state.selectedImages.length > 0) {
        selectedInfo.classList.remove('hidden');
        selectedCount.textContent = state.selectedImages.length;
    } else {
        selectedInfo.classList.add('hidden');
    }

    // 뷰 업데이트
    if (state.currentCropImage) {
        showCropEditor();
    } else if (state.selectedImages.length > 0 && state.currentPreset) {
        showBatchCrop();
    } else {
        hideCropEditor();
        hideBatchCrop();
    }
}

function selectPreset(id) {
    state.currentPreset = presets.find(p => p.id === id);
    updateEditTab();
    
    if (state.selectedImages.length > 0) {
        showBatchCrop();
    }
}

// ===== 크롭 편집기 =====
let cropArea = { x: 0, y: 75, width: 100, height: 25 };

function showCropEditor() {
    document.getElementById('cropEditor').classList.remove('hidden');
    document.getElementById('batchCrop').classList.add('hidden');
    
    const img = state.currentCropImage;
    const cropImage = document.getElementById('cropImage');
    cropImage.src = img.dataUrl;
    
    // 기존 크롭 데이터가 있으면 사용
    if (img.cropData) {
        cropArea = { ...img.cropData.area };
        document.getElementById('commentInput').value = img.comment || '';
    } else if (state.currentPreset) {
        cropArea = { x: 0, y: state.currentPreset.y, width: 100, height: state.currentPreset.height };
    }

    cropImage.onload = () => {
        renderCropOverlay();
    };
}

function hideCropEditor() {
    document.getElementById('cropEditor').classList.add('hidden');
    state.currentCropImage = null;
}

function cancelCrop() {
    hideCropEditor();
    switchTab('input');
}

function renderCropOverlay() {
    const overlay = document.getElementById('cropOverlay');
    
    overlay.innerHTML = `
        <div class="crop-area pointer-events-auto" style="
            left: ${cropArea.x}%;
            top: ${cropArea.y}%;
            width: ${cropArea.width}%;
            height: ${cropArea.height}%;
        ">
            <div class="resize-handle handle-se"></div>
        </div>
    `;

    // 드래그 이벤트 (간단한 구현 - 이동만)
    const cropBox = overlay.querySelector('.crop-area');
    const img = document.getElementById('cropImage');
    let isDragging = false;
    let startX, startY;

    cropBox.addEventListener('mousedown', (e) => {
        if (e.target === cropBox) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            e.preventDefault();
        }
    });

    cropBox.addEventListener('touchstart', (e) => {
        if (e.target === cropBox) {
            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            e.preventDefault();
        }
    });

    const handleMove = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = ((clientX - startX) / img.offsetWidth) * 100;
        const dy = ((clientY - startY) / img.offsetHeight) * 100;
        
        cropArea.x = Math.max(0, Math.min(100 - cropArea.width, cropArea.x + dx));
        cropArea.y = Math.max(0, Math.min(100 - cropArea.height, cropArea.y + dy));
        
        startX = clientX;
        startY = clientY;
        renderCropOverlay();
    };

    document.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    });

    const stopDrag = () => { isDragging = false; };
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
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
    switchTab('input');
}

// ===== 배치 크롭 =====
function showBatchCrop() {
    document.getElementById('batchCrop').classList.remove('hidden');
    document.getElementById('cropEditor').classList.add('hidden');
}

function hideBatchCrop() {
    document.getElementById('batchCrop').classList.add('hidden');
}

function cancelBatch() {
    state.selectedImages = [];
    renderImageGallery();
    updateEditTab();
}

async function startBatchCrop() {
    if (!state.currentPreset) {
        showToast('프리셋을 선택해주세요');
        return;
    }

    const button = document.getElementById('batchButton');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    button.disabled = true;
    progressBar.classList.remove('hidden');

    const total = state.selectedImages.length;
    const area = { x: 0, y: state.currentPreset.y, width: 100, height: state.currentPreset.height };

    for (let i = 0; i < total; i++) {
        const id = state.selectedImages[i];
        const img = state.images.find(im => im.id === id);
        
        const croppedDataUrl = await cropImage(img.dataUrl, area);
        img.cropped = true;
        img.cropData = {
            dataUrl: croppedDataUrl,
            area: { ...area }
        };

        const progress = ((i + 1) / total) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }

    showToast(`${total}개 이미지 크롭 완료`);
    state.selectedImages = [];
    button.disabled = false;
    progressBar.classList.add('hidden');
    renderImageGallery();
    hideBatchCrop();
}

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
    const list = document.getElementById('croppedList');
    const composeButton = document.getElementById('composeButton');

    count.textContent = croppedImages.length;
    composeButton.disabled = croppedImages.length === 0;

    list.innerHTML = croppedImages.map((img, idx) => `
        <div class="flex items-center gap-3 p-2 border rounded-lg">
            <div class="text-lg font-bold text-gray-400">${idx + 1}</div>
            <img src="${img.cropData.dataUrl}" class="w-16 h-16 object-cover rounded">
            <div class="flex-1 text-sm">
                ${img.comment ? `<div class="text-gray-700">"${img.comment}"</div>` : '<div class="text-gray-400">코멘트 없음</div>'}
            </div>
        </div>
    `).join('');
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
