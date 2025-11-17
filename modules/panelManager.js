// Alt panelin (detay ve liste görünümleri) yönetimiyle ilgili tüm mantığı içerir.

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {};

// Sürükleme durumu için değişkenler
let isDragging = false;
let startY = 0;
let startHeight = 0;

export function initPanelManager(cbs) {
    callbacks = cbs;
    gorunumDegistirBtn.addEventListener('click', () => {
        if (altPanel.classList.contains('visible')) {
            callbacks.onDeselect();
        } else {
            callbacks.onShowListView();
        }
    });
}

function showDetailView(gorev) {
    altPanel.classList.remove('liste-acik');
    altPanel.innerHTML = `
        <div class="panel-handle"></div>
        <div class="panel-content">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
            <p>${gorev.tamAdres}</p>
            ${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}
            <div class="action-buttons">
                <button id="nav-btn">Navigasyon</button>
                <button id="route-btn">Rota Çiz</button>
                <button id="delivered-btn" class="status-btn">Verildi</button>
                <button id="not-home-btn" class="status-btn">Evde Yok</button>
                ${gorev.telefon ? `<button id="call-btn">Ara</button>` : ''}
            </div>
        </div>
    `;
    
    // GÜNCELLENDİ: Paneli açma mantığı basitleştirildi
    openPanel(); 
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
    attachPanelEvents(gorev); // Görev verisini de gönder
}

function showListView(filtrelenmisGorevler) {
    altPanel.classList.add('liste-acik');
    altPanel.innerHTML = `
        <div class="panel-handle"></div>
        <div class="panel-content">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <div id="gorev-listesi">
                ${filtrelenmisGorevler.length > 0 ? filtrelenmisGorevler.map(gorev => `
                    <div class="gorev-karti" data-id="${gorev.id}">
                        <h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4>
                        <p>${gorev.tamAdres}</p>
                    </div>
                `).join('') : '<p style="text-align:center;">Bu mahallede görev yok.</p>'}
            </div>
        </div>
    `;
    
    // GÜNCELLENDİ: Paneli açma mantığı basitleştirildi
    openPanel();
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
    attachPanelEvents();
}

function hidePanel() {
    altPanel.classList.remove('visible');
    updateControlPositions(0);
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

// GÜNCELLENDİ: openPanel artık yükseklik parametresi almıyor
function openPanel() {
    // Önce paneli görünür yap
    altPanel.classList.add('visible');

    // Animasyonun bitmesini bekle ve sonra buton pozisyonlarını ayarla
    // Bu, panelin gerçek yüksekliğinin doğru ölçülmesini sağlar
    setTimeout(() => {
        const currentHeight = altPanel.offsetHeight;
        updateControlPositions(currentHeight);
        // Liste görünümü ise yüksekliğini %50 ile sınırla
        if (altPanel.classList.contains('liste-acik')) {
            altPanel.style.height = '50vh';
            updateControlPositions(window.innerHeight * 0.5);
        } else {
            // Detay görünümü ise yüksekliği auto olsun
            altPanel.style.height = 'auto';
        }
    }, 400); // CSS transition süresiyle aynı
}

function updateControlPositions(panelHeight) {
    if (window.innerWidth > 600) return;
    const customControls = document.querySelector('.custom-controls');
    const navigationBtn = document.getElementById('navigation-toggle-btn');
    if (!customControls || !navigationBtn) return;

    const bottomOffset = panelHeight + 20;
    navigationBtn.style.bottom = `${bottomOffset}px`;
    customControls.style.transform = `translateY(-50%) translateY(-${panelHeight / 2}px)`;
}

function attachPanelEvents(gorev = null) {
    document.getElementById('close-btn').addEventListener('click', () => callbacks.onDeselect());

    const handle = altPanel.querySelector('.panel-handle');
    if (handle) {
        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
    }

    if (altPanel.classList.contains('liste-acik')) {
        altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
            kart.addEventListener('click', (e) => {
                callbacks.onGorevSelect(parseInt(e.currentTarget.dataset.id, 10));
            });
        });
    } else if(gorev) { // Detay görünümü ise
        document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
        document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, e.target));
        document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));
        document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));
        if (gorev.telefon) {
            document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
        }
    }
}


// --- SÜRÜKLEME FONKSİYONLARI ---
function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none';
    const customControls = document.querySelector('.custom-controls');
    const navigationBtn = document.getElementById('navigation-toggle-btn');
    if(customControls) customControls.style.transition = 'none';
    if(navigationBtn) navigationBtn.style.transition = 'none';

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('touchmove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
}

function doDrag(e) {
    if (!isDragging) return;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = startY - currentY;
    let newHeight = startHeight + delta;

    const maxHeight = window.innerHeight * 0.85;
    if (newHeight > maxHeight) newHeight = maxHeight;
    if (newHeight < 100) newHeight = 100;

    altPanel.style.height = `${newHeight}px`;
    updateControlPositions(newHeight);
}

function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'transform 0.4s ease-in-out, height 0.4s ease-in-out';
    const customControls = document.querySelector('.custom-controls');
    const navigationBtn = document.getElementById('navigation-toggle-btn');
    if(customControls) customControls.style.transition = 'transform 0.4s ease-in-out';
    if(navigationBtn) navigationBtn.style.transition = 'bottom 0.4s ease-in-out';

    const currentHeight = altPanel.offsetHeight;
    if (currentHeight < 150) {
        callbacks.onDeselect();
    } else if (altPanel.classList.contains('liste-acik')) {
        // Liste için bir hedef noktaya çek (örn: %50)
        const targetHeight = window.innerHeight * 0.5;
        altPanel.style.height = `${targetHeight}px`;
        updateControlPositions(targetHeight);
    }
}

export { showDetailView, showListView, hidePanel };
