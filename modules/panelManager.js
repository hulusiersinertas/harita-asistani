// Alt panelin (detay ve liste görünümleri) yönetimiyle ilgili tüm mantığı içerir.

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {};
let isDragging = false, startY = 0, startHeight = 0;

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
    // Detay görünümü için panelin yüksekliği CSS'te 'auto' olarak ayarlandı
    altPanel.style.height = 'auto'; 
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
    
    openPanel();
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
    attachPanelEvents(gorev);
}

function showListView(filtrelenmisGorevler) {
    altPanel.classList.add('liste-acik');
    // Liste görünümü için yüksekliği CSS'te '50vh' olarak ayarlandı
    altPanel.style.height = '50vh';
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
    
    openPanel();
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
    attachPanelEvents();
}

function hidePanel() {
    altPanel.classList.remove('visible');
    updateControlPositions(0);
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

function openPanel() {
    altPanel.classList.add('visible');
    // Panelin açıldıktan sonraki anlık yüksekliğine göre butonları ayarla
    // requestAnimationFrame tarayıcının paneli çizmesini bekler
    requestAnimationFrame(() => {
        updateControlPositions(altPanel.offsetHeight);
    });
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
    } else if(gorev) {
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
    altPanel.style.transition = 'none'; // Sürüklerken animasyonları kapat
    document.body.style.userSelect = 'none'; // Metin seçimini engelle

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
    altPanel.style.transition = 'transform 0.4s ease-out, height 0.4s ease-out';
    document.body.style.userSelect = 'auto';

    const currentHeight = altPanel.offsetHeight;
    if (currentHeight < 150) { // Yeterince aşağı çekildiyse kapat
        callbacks.onDeselect();
    } else if (altPanel.classList.contains('liste-acik')) { // Liste ise %50'ye geri çek
        const targetHeight = window.innerHeight * 0.5;
        altPanel.style.height = `${targetHeight}px`;
        updateControlPositions(targetHeight);
    }
    
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('touchmove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

export { showDetailView, showListView, hidePanel };
