// DOSYA: modules/panelManager.js (TAMAMINI DEĞİŞTİR)

const altPanel = document.getElementById('alt-panel');
// Liste butonu kaldırıldığı için buradaki listener'ı da siliyoruz.
// const gorunumDegistirBtn = ... (GEREK YOK)

let callbacks = {};
let startY = 0;
let startHeight = 0;
let isDragging = false;

const SHEET_PEEK_HEIGHT = 180; 
const SHEET_MAX_HEIGHT_PERCENT = 60; // Yarıdan biraz fazla olsun

export function initPanelManager(cbs) {
    callbacks = cbs;
    
    // Liste butonu listener'ı kaldırıldı.
    
    setupDragListeners();
}

function setupDragListeners() {
    // --- MOBİL (TOUCH) ---
    altPanel.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientY, e.target), { passive: false });
    document.addEventListener('touchmove', (e) => onDrag(e.touches[0].clientY, e), { passive: false });
    document.addEventListener('touchend', endDrag);

    // --- PC (MOUSE) --- (SORUN 2 ÇÖZÜMÜ)
    altPanel.addEventListener('mousedown', (e) => startDrag(e.clientY, e.target));
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault(); // Yazı seçimini engelle
            onDrag(e.clientY, e);
        }
    });
    document.addEventListener('mouseup', endDrag);
}

// Sürükleme Başlatma Mantığı
function startDrag(clientY, target) {
    // SORUN 3 ÇÖZÜMÜ: Sadece Header veya Handle tutulursa sürüklemeye izin ver.
    // İçerik (liste) tutulursa sürükleme başlatma, bırak kendi scroll'unu yapsın.
    const isHandle = target.closest('.sheet-handle');
    const isHeader = target.closest('.detail-header'); // Başlık kısmı

    if (!isHandle && !isHeader) return;

    isDragging = true;
    startY = clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none'; // Sürüklerken animasyon olmasın
}

// Sürükleme Sırası
function onDrag(clientY, event) {
    if (!isDragging) return;
    
    // Tarayıcının varsayılan kaydırmasını engelle (Telefonda sayfa yenilemeyi tetiklemesin)
    if(event.cancelable) event.preventDefault();

    const deltaY = startY - clientY; // Yukarı çekerken delta pozitif olur
    const newHeight = startHeight + deltaY;
    
    const maxHeight = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // Minimum 50px, Maksimum sınıra kadar izin ver
    if (newHeight > 50 && newHeight < maxHeight + 50) {
         altPanel.style.height = `${newHeight}px`;
    }
}

// Bırakma
function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    snapSheet();
}

function snapSheet() {
    const currentH = altPanel.offsetHeight;
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // Çok aşağı çekildiyse kapat (100px altı)
    if (currentH < 120) {
        callbacks.onDeselect();
    } 
    // Peek yüksekliğinden fazlaysa tam aç
    else if (currentH > SHEET_PEEK_HEIGHT + 50) {
        altPanel.style.height = `${maxH}px`;
    } 
    // Değilse peek moduna geri dön
    else {
        altPanel.style.height = `${SHEET_PEEK_HEIGHT}px`;
    }
}

function setPanelContent(htmlContent, heightMode = 'peek') {
    altPanel.innerHTML = htmlContent;
    altPanel.style.display = 'flex';
    altPanel.classList.add('panel-open');
    
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    const targetHeight = heightMode === 'full' ? maxH : SHEET_PEEK_HEIGHT;
    
    requestAnimationFrame(() => {
        altPanel.style.height = `${targetHeight}px`;
    });
    adjustFabPosition(true);
}

export function showDetailView(gorev) {
    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <div>
                    <h2>${gorev.adSoyad} (${gorev.miktar})</h2>
                    <p>${gorev.tamAdres}</p>
                    ${gorev.adresNotu ? `<p style="color:#d97706; font-size:0.8rem; margin-top:4px;">Not: ${gorev.adresNotu}</p>` : ''}
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
    // Eğer başlık gönderilmediyse varsayılan başlığı oluştur
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
    adjustFabPosition(false);
}

function adjustFabPosition(isOpen) {
    const fab = document.getElementById('navigation-toggle-btn');
    if (!fab) return;
    if (isOpen) {
        fab.style.transform = 'translateY(-190px)';
    } else {
        fab.style.transform = 'translateY(0)';
    }
}

