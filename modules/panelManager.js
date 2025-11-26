const altPanel = document.getElementById('alt-panel');

let callbacks = {};
let startY = 0;
let startHeight = 0;
let isDragging = false;

// ARTIK SABİT DEĞİL, DEĞİŞKEN (Otomatik Hesaplanacak)
let currentPeekHeight = 180; 
const SHEET_MAX_HEIGHT_PERCENT = 85; // Ekranın %85'ine kadar çıkabilsin

export function initPanelManager(cbs) {
    callbacks = cbs;
    setupDragListeners();
}

function setupDragListeners() {
    // --- MOBİL (TOUCH) ---
    altPanel.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientY, e.target), { passive: false });
    document.addEventListener('touchmove', (e) => onDrag(e.touches[0].clientY, e), { passive: false });
    document.addEventListener('touchend', endDrag);

    // --- PC (MOUSE) ---
    altPanel.addEventListener('mousedown', (e) => startDrag(e.clientY, e.target));
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            onDrag(e.clientY, e);
        }
    });
    document.addEventListener('mouseup', endDrag);
}

function startDrag(clientY, target) {
    const isHandle = target.closest('.sheet-handle');
    const isHeader = target.closest('.detail-header');

    if (!isHandle && !isHeader) return;

    isDragging = true;
    startY = clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none';
}

function onDrag(clientY, event) {
    if (!isDragging) return;
    if(event.cancelable) event.preventDefault();

    const deltaY = startY - clientY;
    const newHeight = startHeight + deltaY;
    
    const maxHeight = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    if (newHeight > 50 && newHeight < maxHeight + 50) {
         altPanel.style.height = `${newHeight}px`;
    }
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    snapSheet();
}

function snapSheet() {
    const currentH = altPanel.offsetHeight;
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // Çok aşağı çekildiyse kapat
    if (currentH < 100) {
        callbacks.onDeselect();
    } 
    // Mevcut içerik boyutundan (peek) fazlaysa tam aç
    else if (currentH > currentPeekHeight + 60) {
        altPanel.style.height = `${maxH}px`;
    } 
    // Değilse, içeriğin boyutu neyse ona geri dön
    else {
        altPanel.style.height = `${currentPeekHeight}px`;
    }
}

function setPanelContent(htmlContent, heightMode = 'peek') {
    altPanel.innerHTML = htmlContent;
    altPanel.style.display = 'flex';
    altPanel.classList.add('panel-open');
    
    // 1. Önce yüksekliği "auto" yapıp gerçek içeriği ölçüyoruz
    altPanel.style.height = 'auto';
    const contentHeight = altPanel.offsetHeight;
    
    // 2. Maksimum sınırı belirle
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // 3. Peek yüksekliğini içeriğe göre ayarla (Ne az ne çok)
    // En az 140px olsun, en fazla MaxH kadar olsun.
    currentPeekHeight = Math.min(Math.max(contentHeight, 140), maxH);

    // 4. Hedef yüksekliği belirle
    // Eğer 'full' mod isteniyorsa maxH, yoksa hesapladığımız içerik boyutu
    const targetHeight = heightMode === 'full' ? maxH : currentPeekHeight;
    
    // 5. Animasyonla uygula
    requestAnimationFrame(() => {
        altPanel.style.height = `${targetHeight}px`;
    });
    
    // UI dosyasındaki buton pozisyonunu güncelleme fonksiyonu varsa çağır
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(true);
    }
}

export function showDetailView(gorev) {
    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <div>
                    <h2>${gorev.adSoyad} (${gorev.miktar})</h2>
                    <p>${gorev.tamAdres}</p>
                    ${gorev.adresNotu ? `<span class="adres-notu-stili">Not: ${gorev.adresNotu}</span>` : ''}
                </div>
                <button id="close-panel-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
            </div>
            <div class="action-grid">
                <button id="nav-btn" class="action-btn"><span class="material-icons-outlined">navigation</span><span class="label">Navigasyon</span></button>
                <button id="route-btn" class="action-btn"><span class="material-icons-outlined">alt_route</span><span class="label">Rota Çiz</span></button>
                <button id="delivered-btn" class="action-btn btn-green"><span class="material-icons-outlined">check_circle</span><span class="label">Verildi</span></button>
                <button id="not-home-btn" class="action-btn btn-red"><span class="material-icons-outlined">home</span><span class="label">Evde Yok</span></button>
                ${gorev.telefon ? `<button id="call-btn" class="action-btn"><span class="material-icons-outlined">call</span><span class="label">Ara</span></button>` : ''}
            </div>
        </div>
    `;
    setPanelContent(html, 'peek');
    
    document.getElementById('close-panel-btn').addEventListener('click', () => callbacks.onDeselect());
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, e.currentTarget));
    document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.currentTarget));
    document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.currentTarget));
    if (gorev.telefon) document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
}

export function showListView(filtrelenmisGorevler, title = null) {
    const displayTitle = title ? title : `Görev Listesi (${filtrelenmisGorevler.length})`;

    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <h2 style="font-size:1rem;">${displayTitle}</h2>
                <button id="close-list-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
            </div>
            <div id="list-container" style="padding-bottom: 20px;">
                ${filtrelenmisGorevler.length === 0 ? '<p style="text-align:center; color:#999; margin-top:20px;">Görev bulunamadı.</p>' : ''}
                
                ${filtrelenmisGorevler.map(gorev => `
                    <div class="gorev-list-item" data-id="${gorev.id}">
                        <h4>${gorev.adSoyad} (${gorev.miktar})</h4>
                        <p>${gorev.mahalle} - ${gorev.tamAdres}</p>
                        ${!gorev.hasCoords ? '<span style="font-size:0.7rem; color:red; font-weight:bold;">KOORDİNAT YOK</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    setPanelContent(html, 'peek');

    document.getElementById('close-list-btn').addEventListener('click', () => callbacks.onDeselect());
    altPanel.querySelectorAll('.gorev-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            callbacks.onGorevSelect(id);
        });
    });
}

export function hidePanel() {
    altPanel.style.height = '0px';
    altPanel.classList.remove('panel-open');
    setTimeout(() => {
        if(!altPanel.classList.contains('panel-open')) altPanel.style.display = 'none';
    }, 300);
    
    // Butonları aşağı indir
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(false);
    }
}
