// DOSYA: modules/panelManager.js

const altPanel = document.getElementById('alt-panel');
let callbacks = {};

// Sürükleme (Drag) Değişkenleri
let startY = 0;
let startHeight = 0;
let isDragging = false;

// Panel Yükseklik Ayarları (%)
const INITIAL_MAX_PERCENT = 50; 
const FULL_MAX_PERCENT = 85;    
const MINI_HEIGHT = 160;        
let currentPeekHeight = 0;

/**
 * Panel yöneticisini başlatır ve event listener'ları kurar.
 */
export function initPanelManager(cbs) {
    callbacks = cbs;
    setupDragListeners();
}

// --- SÜRÜKLEME MANTIĞI (DRAG & DROP) ---
function setupDragListeners() {
    // Mobil (Touch)
    altPanel.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientY, e.target), { passive: false });
    document.addEventListener('touchmove', (e) => onDrag(e.touches[0].clientY, e), { passive: false });
    document.addEventListener('touchend', endDrag);

    // Masaüstü (Mouse)
    altPanel.addEventListener('mousedown', (e) => startDrag(e.clientY, e.target));
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault(); // Seçimi engelle
            onDrag(e.clientY, e);
        }
    });
    document.addEventListener('mouseup', endDrag);
}

function startDrag(clientY, target) {
    // Sadece gri tutamaçtan veya başlıktan tutulursa sürükle
    const isHandle = target.closest('.sheet-handle');
    const isHeader = target.closest('.detail-header');
    
    // Eğer butonlara tıklanıyorsa sürüklemeyi başlatma
    if (target.tagName === 'BUTTON' || target.closest('button')) return;

    if (!isHandle && !isHeader) return;
    
    isDragging = true;
    startY = clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none'; // Sürüklerken animasyonu kapat
}

function onDrag(clientY, event) {
    if (!isDragging) return;
    if(event.cancelable) event.preventDefault();
    
    const deltaY = startY - clientY; // Yukarı sürükleyince pozitif
    const newHeight = startHeight + deltaY;
    const maxH = (window.innerHeight * FULL_MAX_PERCENT) / 100;

    // Sınırlar içinde kal
    if (newHeight > 50 && newHeight < maxH + 50) {
         altPanel.style.height = `${newHeight}px`;
    }
}

function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'height 0.3s cubic-bezier(0.25, 1, 0.5, 1)'; // Animasyonu geri aç
    snapSheet();
}

/**
 * Paneli en yakın durma noktasına (Tam, Yarım, Mini) yapıştırır.
 */
function snapSheet() {
    const currentH = altPanel.offsetHeight;
    const fullH = (window.innerHeight * FULL_MAX_PERCENT) / 100;
    const midH = currentPeekHeight > 0 ? currentPeekHeight : (window.innerHeight * INITIAL_MAX_PERCENT) / 100;
    const miniH = MINI_HEIGHT;      

    // Çok aşağı çekildiyse kapat
    if (currentH < 100) {
        callbacks.onDeselect();
        return;
    }

    const distToFull = Math.abs(currentH - fullH);
    const distToMid = Math.abs(currentH - midH);
    const distToMini = Math.abs(currentH - miniH);

    const minDist = Math.min(distToFull, distToMid, distToMini);

    if (minDist === distToFull) altPanel.style.height = `${fullH}px`;
    else if (minDist === distToMid) altPanel.style.height = `${midH}px`;
    else altPanel.style.height = `${miniH}px`;
}

// --- İÇERİK YÖNETİMİ ---

function setPanelContent(htmlContent) {
    altPanel.innerHTML = htmlContent;
    altPanel.style.display = 'flex';
    
    // Paneli görünür yap
    requestAnimationFrame(() => {
        altPanel.classList.add('panel-open');
    });

    // İçeriğe göre yükseklik hesapla
    altPanel.style.height = 'auto';
    const contentHeight = altPanel.offsetHeight;
    const halfScreen = (window.innerHeight * INITIAL_MAX_PERCENT) / 100;
    
    // Yarım ekranı geçmesin ama çok küçük de olmasın
    currentPeekHeight = Math.min(contentHeight + 20, halfScreen);
    currentPeekHeight = Math.max(currentPeekHeight, MINI_HEIGHT);

    // Yüksekliği ayarla
    requestAnimationFrame(() => {
        altPanel.style.height = `${currentPeekHeight}px`;
    });

    // FAB butonunun yerini ayarla (ui.js içinde tanımlı olabilir)
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(true);
    }
}

/**
 * TEKİL GÖREV DETAY GÖRÜNÜMÜ
 * (Rotaya ekle/çıkar butonlarını içerir)
 */
export function showDetailView(gorev) {
    // Sıra kontrolü (9000'den küçükse rotadadır varsayımı)
    const isInRoute = gorev.siraNo && gorev.siraNo < 9000;

    // Rota Yönetim Butonları HTML'i
    let routeControlsHtml = '';
    
    if (isInRoute) {
        // Zaten rotada ise: Yukarı/Aşağı oklar ve Çıkar butonu
        // GÜNCELLEME: data-dir değerleri tersine çevrildi
        // Yukarı Ok (-1 idi -> 1 oldu)
        // Aşağı Ok (1 idi -> -1 oldu)
        routeControlsHtml = `
            <div class="route-controls-container" style="display:flex; align-items:center; gap:5px; background:#f0f9ff; padding:5px; border-radius:8px; border:1px solid #bae6fd;">
                <button class="route-move-btn circle-btn" style="width:32px; height:32px; border:1px solid #ddd;" data-dir="1" data-id="${gorev.id}"><span class="material-icons" style="font-size:18px;">arrow_upward</span></button>
                <div style="font-weight:bold; color:#0284c7; min-width:24px; text-align:center; font-size:1.1rem;">${gorev.siraNo}</div>
                <button class="route-move-btn circle-btn" style="width:32px; height:32px; border:1px solid #ddd;" data-dir="-1" data-id="${gorev.id}"><span class="material-icons" style="font-size:18px;">arrow_downward</span></button>
                <div style="width:1px; height:20px; background:#ccc; margin:0 4px;"></div>
                <button class="route-remove-btn circle-btn" style="width:32px; height:32px; border:1px solid #fee2e2; background:#fef2f2;" data-id="${gorev.id}" title="Rotadan Çıkar">
                    <span class="material-icons" style="font-size:18px; color:#ef4444;">close</span>
                </button>
            </div>
        `;
    } else {
        // Rotada değilse: Büyük "Rotaya Ekle" butonu
        routeControlsHtml = `
            <button id="add-to-route-btn" class="action-btn" style="background:#f0f9ff; border:1px dashed #0284c7; color:#0284c7; flex-direction:row; gap:8px; height:48px; min-height:auto; width:100%;">
                <span class="material-icons-outlined" style="font-size:22px; margin:0; color:#0284c7;">add_link</span>
                <span class="label" style="font-size:0.95rem; color:#0284c7;">Rotaya Ekle</span>
            </button>
        `;
    }

    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header" style="flex-direction: column; align-items: stretch;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; padding-right:10px;">
                        <h2>${gorev.adSoyad} (${gorev.miktar})</h2>
                    </div>
                    <button id="close-panel-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                    <div style="flex:1;">
                         <p>${gorev.tamAdres}</p>
                         ${gorev.adresNotu ? `<span class="adres-notu-stili">Not: ${gorev.adresNotu}</span>` : ''}
                    </div>
                    <!-- Rotadaysa kontrolleri sağda göster -->
                    ${isInRoute ? `<div>${routeControlsHtml}</div>` : ''}
                </div>
            </div>
            
            <!-- Rotada değilse butonu aşağıda tam genişlikte göster -->
            ${!isInRoute ? `<div style="margin-bottom:16px;">${routeControlsHtml}</div>` : ''}

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
    
    // --- Event Listeners ---
    document.getElementById('close-panel-btn').addEventListener('click', () => callbacks.onDeselect());
    
    // Navigasyon (Yandex Maps Web)
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    
    // Rota Çiz (Uygulama İçi)
    document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, e.currentTarget));
    
    // Durum Güncelleme (Not sorarak)
    const handleStatusClick = (status, btn) => {
        let note = "";
        const userNote = prompt("Varsa notunuzu girin (İsteğe bağlı):");
        if (userNote !== null) note = userNote; // İptal denmediyse
        callbacks.onStatusUpdate(status, gorev.id, gorev.adSoyad, btn, note);
    };

    document.getElementById('delivered-btn').addEventListener('click', (e) => handleStatusClick('Verildi', e.currentTarget));
    document.getElementById('not-home-btn').addEventListener('click', (e) => handleStatusClick('Evde Yok', e.currentTarget));
    
    if (gorev.telefon) document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);

    // Rota Butonları Listener
    if (isInRoute) {
        altPanel.querySelectorAll('.route-move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Panelin sürüklenmesini tetikleme ihtimaline karşı
                const dir = parseInt(e.currentTarget.dataset.dir);
                callbacks.onRouteMove(gorev, dir);
            });
        });
        altPanel.querySelector('.route-remove-btn').addEventListener('click', (e) => {
             e.stopPropagation();
             callbacks.onRouteRemove(gorev);
        });
    } else {
        document.getElementById('add-to-route-btn').addEventListener('click', () => callbacks.onRouteAdd(gorev));
    }
}

/**
 * ÖZEL ROTA LİSTESİ GÖRÜNÜMÜ (YENİ)
 * Sıralanabilir, input ile değiştirilebilir liste.
 */
export function showCustomRouteListView(routeTasks) {
    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <h2 style="font-size:1rem;">Dağıtım Listem (${routeTasks.length})</h2>
                <button id="close-custom-list-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
            </div>
            <div id="custom-route-list-container" style="padding-bottom: 20px;">
                ${routeTasks.length === 0 ? '<p style="text-align:center; color:#999; margin-top:20px;">Listeniz boş.<br>Haritadan bir görev seçip "Rotaya Ekle" diyebilirsiniz.</p>' : ''}
                
                ${routeTasks.map(gorev => `
                    <div class="gorev-list-item" style="display:flex; align-items:center; gap:12px; padding:10px;">
                        
                        <!-- Manuel Sıra Girişi -->
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <input type="number" class="manual-sira-input" data-id="${gorev.id}" value="${gorev.siraNo}" 
                                style="width:40px; padding:8px 4px; border:1px solid #ccc; border-radius:8px; text-align:center; font-weight:bold; font-size:1rem; color:#0284c7;">
                        </div>
                        
                        <!-- Görev Bilgisi (Tıklanınca Haritada Gider) -->
                        <div style="flex:1; cursor:pointer;" class="go-to-task" data-id="${gorev.id}">
                            <h4 style="font-size:0.95rem; margin:0; color:#1e293b;">${gorev.adSoyad}</h4>
                            <p style="font-size:0.8rem; margin:2px 0 0 0; color:#64748b;">${gorev.mahalle} • ${gorev.miktar}</p>
                        </div>

                        <!-- Yukarı/Aşağı Butonları (GÜNCELLENDİ: data-dir tersine çevrildi) -->
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <button class="mini-move-btn circle-btn" data-id="${gorev.id}" data-dir="1" style="width:32px; height:32px; border:1px solid #eee;">
                                <span class="material-icons" style="font-size:20px; color:#64748b;">keyboard_arrow_up</span>
                            </button>
                            <button class="mini-move-btn circle-btn" data-id="${gorev.id}" data-dir="-1" style="width:32px; height:32px; border:1px solid #eee;">
                                <span class="material-icons" style="font-size:20px; color:#64748b;">keyboard_arrow_down</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    setPanelContent(html);

    // Kapat
    document.getElementById('close-custom-list-btn').addEventListener('click', () => callbacks.onDeselect());

    // 1. Tıklayınca göreve git
    altPanel.querySelectorAll('.go-to-task').forEach(div => {
        div.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            callbacks.onGorevSelect(id);
        });
    });

    // 2. Manuel Input Değişimi
    altPanel.querySelectorAll('.manual-sira-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const val = e.currentTarget.value;
            // İlgili görevi bulup callback'e gönder
            // (Not: routeTasks closure içinde mevcut)
            const gorev = routeTasks.find(g => g.id === id);
            if(gorev) callbacks.onManualSiraChange(gorev, val);
        });
    });

    // 3. Ok Tuşları
    altPanel.querySelectorAll('.mini-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            const dir = parseInt(e.currentTarget.dataset.dir);
            const gorev = routeTasks.find(g => g.id === id);
            if(gorev) callbacks.onRouteMove(gorev, dir);
        });
    });
}

/**
 * STANDART LİSTE GÖRÜNÜMÜ (Mahalle Filtresi vb.)
 */
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
                        <div style="display:flex; justify-content:space-between;">
                            <h4>${gorev.adSoyad} (${gorev.miktar})</h4>
                            ${gorev.siraNo < 9000 ? `<span style="font-size:0.7rem; background:#f0f9ff; color:#0284c7; padding:2px 6px; border-radius:4px;">#${gorev.siraNo}</span>` : ''}
                        </div>
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

/**
 * GEÇMİŞ GÖRÜNÜMÜ
 */
export function showHistoryView(completedTasks) {
    const html = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <h2 style="font-size:1rem;">Tamamlananlar (${completedTasks.length})</h2>
                <button id="close-history-btn" class="close-btn-mini"><span class="material-icons-outlined">close</span></button>
            </div>
            <div id="history-list-container" style="padding-bottom: 20px;">
                ${completedTasks.length === 0 ? '<p style="text-align:center; color:#999; margin-top:20px;">Henüz tamamlanan görev yok.</p>' : ''}
                
                ${completedTasks.map(gorev => `
                    <div class="gorev-list-item history-item" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                        <div style="flex:1;">
                            <h4 style="color:#888; text-decoration: line-through;">${gorev.adSoyad}</h4>
                            <p style="font-size:0.75rem;">
                                ${gorev.mahalle} • 
                                <strong style="color:${gorev.durum === 'Verildi' ? 'green' : 'red'}">${gorev.durum}</strong>
                                ${gorev.tamamlanmaZamani ? ` • <span style="color:#777;">${gorev.tamamlanmaZamani}</span>` : ''}
                            </p>
                            ${gorev.not ? `<p style="font-size:0.75rem; color:#d97706; margin-top:2px;">📝 ${gorev.not}</p>` : ''}
                        </div>
                        <button class="undo-btn circle-btn" style="width:36px; height:36px; flex-shrink:0;" data-id="${gorev.id}" title="Geri Al">
                            <span class="material-icons-outlined" style="font-size:18px; color:orange;">undo</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    setPanelContent(html);

    document.getElementById('close-history-btn').addEventListener('click', () => callbacks.onDeselect());
    
    altPanel.querySelectorAll('.undo-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            callbacks.onUndo(id);
        });
    });
}

/**
 * Paneli Gizle
 */
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
