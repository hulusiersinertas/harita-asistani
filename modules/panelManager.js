const altPanel = document.getElementById('alt-panel');

let callbacks = {};
let startY = 0;
let startHeight = 0;
let isDragging = false;

// --- AYARLAR ---
const INITIAL_MAX_PERCENT = 50; // Yarım ekran yüzdesi
const FULL_MAX_PERCENT = 95;    // Tam ekran yüzdesi
const MINI_HEIGHT = 160;        // YENİ: En küçük durabileceği yükseklik (Mini Mod)

// O anki "Yarım" yüksekliğin kaç piksel olduğu
let currentPeekHeight = 0;

export function initPanelManager(cbs) {
    callbacks = cbs;
    setupDragListeners();
}

function setupDragListeners() {
    // Mobil Dokunmatik
    altPanel.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientY, e.target), { passive: false });
    document.addEventListener('touchmove', (e) => onDrag(e.touches[0].clientY, e), { passive: false });
    document.addEventListener('touchend', endDrag);

    // Mouse (PC)
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
    altPanel.style.transition = 'none'; // Sürüklerken animasyonu kapat
}

function onDrag(clientY, event) {
    if (!isDragging) return;
    if(event.cancelable) event.preventDefault();

    const deltaY = startY - clientY; // Yukarı hareket pozitiftir
    const newHeight = startHeight + deltaY;
    
    const maxH = (window.innerHeight * FULL_MAX_PERCENT) / 100;
    
    // Aşağı inerken 50px'e kadar inebilsin (Kapanma hissi için)
    if (newHeight > 50 && newHeight < maxH + 50) {
         altPanel.style.height = `${newHeight}px`;
    }
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    snapSheet();
}

/**
 * MIKNATIS MANTIĞI (SNAP LOGIC)
 * Paneli bıraktığında en yakın durağa yapışır.
 */
function snapSheet() {
    const currentH = altPanel.offsetHeight;
    const fullH = (window.innerHeight * FULL_MAX_PERCENT) / 100;
    const midH = currentPeekHeight; // %50 veya içerik boyutu
    const miniH = MINI_HEIGHT;      // ~160px
    
    // 1. KAPANMA: Eğer 80px'den daha küçükse kapat
    if (currentH < 80) {
        callbacks.onDeselect();
        return;
    }

    // 2. HANGİ DURAĞA DAHA YAKIN?
    const distToFull = Math.abs(currentH - fullH);
    const distToMid = Math.abs(currentH - midH);
    const distToMini = Math.abs(currentH - miniH);

    // En küçük mesafeyi bul
    const minDist = Math.min(distToFull, distToMid, distToMini);

    if (minDist === distToFull) {
        // Tam Ekrana git
        altPanel.style.height = `${fullH}px`;
    } else if (minDist === distToMid) {
        // Yarım Ekrana git
        altPanel.style.height = `${midH}px`;
    } else {
        // Mini Moda git (Aşağı çektin, burada dur)
        altPanel.style.height = `${miniH}px`;
    }
}

function setPanelContent(htmlContent) {
    altPanel.innerHTML = htmlContent;
    altPanel.style.display = 'flex';
    altPanel.classList.add('panel-open');
    
    // İçeriği ölç
    altPanel.style.height = 'auto';
    const contentHeight = altPanel.offsetHeight;
    
    // Ekranın %50'si
    const halfScreen = (window.innerHeight * INITIAL_MAX_PERCENT) / 100;
    
    // Yarım ekran yüksekliğini belirle (İçerik küçükse içerik kadar, büyükse %50)
    currentPeekHeight = Math.min(contentHeight, halfScreen);
    // Ama Mini moddan küçük olmasın, yoksa hesap şaşar
    currentPeekHeight = Math.max(currentPeekHeight, MINI_HEIGHT + 20);

    // İlk açılışta Yarım Ekrana (Peek) git
    requestAnimationFrame(() => {
        altPanel.style.height = `${currentPeekHeight}px`;
    });
    
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
    setPanelContent(html);
    
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
    setPanelContent(html);

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
    
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(false);
    }
}
