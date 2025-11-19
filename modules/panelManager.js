// DOSYA: modules/panelManager.js (TAMAMEN YENİLENMİŞ DRAGGABLE MANTIK)

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {};
let startY = 0;
let currentHeight = 0;
let isDragging = false;
const SHEET_PEEK_HEIGHT = 180; // Açılıştaki küçük yükseklik (px)
const SHEET_MAX_HEIGHT_PERCENT = 50; // Maksimum yükseklik (%)

export function initPanelManager(cbs) {
    callbacks = cbs;
    gorunumDegistirBtn.addEventListener('click', () => {
        if (altPanel.classList.contains('panel-open')) {
             // Eğer zaten açıksa kapat
            callbacks.onDeselect();
        } else {
            callbacks.onShowListView();
        }
    });

    // Sürükleme Olaylarını Dinle (ÇÖZÜM 4)
    setupDragListeners();
}

function setupDragListeners() {
    // Touch Events (Mobil)
    altPanel.addEventListener('touchstart', (e) => {
        // Sadece header veya handle kısmından tutulursa sürüklemeye izin ver
        // İçerik kısmında kaydırma (scroll) bozulmasın diye
        const target = e.target;
        const isHeader = target.closest('.sheet-handle') || target.closest('.detail-header');
        
        // Liste en üstteyse ve aşağı çekiliyorsa da izin verilebilir ama basitleştirelim:
        if (isHeader || altPanel.scrollTop <= 0) {
            isDragging = true;
            startY = e.touches[0].clientY;
            currentHeight = altPanel.offsetHeight;
            altPanel.style.transition = 'none'; // Sürüklerken animasyon olmasın
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaY = startY - e.touches[0].clientY;
        const newHeight = currentHeight + deltaY;
        
        // Yükseklik sınırları
        const maxHeight = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
        
        if (newHeight > 60 && newHeight <= maxHeight + 50) { // Biraz esneme payı (+50)
             altPanel.style.height = `${newHeight}px`;
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        altPanel.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)'; // Yaylanma efekti
        snapSheet();
    });
}

// Paneli en yakın mantıklı noktaya yapıştır (Snap)
function snapSheet() {
    const currentH = altPanel.offsetHeight;
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // Eğer yarıyı geçtiyse tam aç (%50), yoksa küçük moda dön (Peek)
    // Eğer çok aşağı çekildiyse kapat
    if (currentH < 100) {
        callbacks.onDeselect(); // Kapat
    } else if (currentH > (maxH - 100)) {
        altPanel.style.height = `${maxH}px`; // Maksimuma çek
    } else {
        altPanel.style.height = `${SHEET_PEEK_HEIGHT}px`; // Küçük moda çek
    }
}

// Ortak İçerik Doldurucu
function setPanelContent(htmlContent, heightMode = 'peek') {
    altPanel.innerHTML = htmlContent;
    altPanel.style.display = 'flex';
    altPanel.classList.add('panel-open');
    
    // ÇÖZÜM 5: İlk açılış yüksekliğini ayarla
    const maxH = (window.innerHeight * SHEET_MAX_HEIGHT_PERCENT) / 100;
    
    // Eğer detay ise hemen tam boy açılabilir, liste ise küçük başlasın (tercih meselesi)
    // Kullanıcı "küçük başlasın" dediği için:
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
    
    // Detay için de 'peek' modunda başlatıyoruz, kullanıcı yukarı çekerse butonları görür.
    // Ya da butonlar sığsın diye biraz daha yüksek başlatabiliriz.
    setPanelContent(html, 'peek'); 

    // Listenerlar
    document.getElementById('close-panel-btn').addEventListener('click', () => callbacks.onDeselect());
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, e.currentTarget));
    document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.currentTarget));
    document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.currentTarget));
    if (gorev.telefon) document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
}

export function showListView(filtrelenmisGorevler) {
    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <h2 style="font-size:1rem;">Görev Listesi (${filtrelenmisGorevler.length})</h2>
                <button id="close-list-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
            </div>
            <div id="list-container" style="padding-bottom: 20px;">
                ${filtrelenmisGorevler.map(gorev => `
                    <div class="gorev-list-item" data-id="${gorev.id}">
                        <h4>${gorev.adSoyad} (${gorev.miktar})</h4>
                        <p>${gorev.mahalle} - ${gorev.tamAdres.substring(0, 30)}...</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // ÇÖZÜM 5: Liste görünümü küçük (peek) modda başlasın
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
    altPanel.style.height = '0px'; // Yüksekliği sıfırla
    altPanel.classList.remove('panel-open');
    setTimeout(() => {
        if(!altPanel.classList.contains('panel-open')) altPanel.style.display = 'none';
    }, 300); // Animasyon bitince gizle
    adjustFabPosition(false);
}

function adjustFabPosition(isOpen) {
    const fab = document.getElementById('navigation-toggle-btn');
    if (!fab) return;
    // FAB'ı panelin üstüne dinamik olarak sabitleyebiliriz veya basitçe yukarı atabiliriz
    // Panel yüksekliği dinamik olduğu için CSS class yerine JS ile style verebiliriz
    if (isOpen) {
        fab.style.transform = 'translateY(-190px)'; // Peek yüksekliğinin hemen üstü
    } else {
        fab.style.transform = 'translateY(0)';
    }
}
