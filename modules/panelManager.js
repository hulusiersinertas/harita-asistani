// Alt panelin (detay ve liste görünümleri) yönetimiyle ilgili tüm mantığı içerir.

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');
const customControls = document.querySelector('.custom-controls');
const navigationBtn = document.getElementById('navigation-toggle-btn');

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
            ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
            <p>${gorev.tamAdres}</p>
            <div class="action-buttons">
                <!-- Butonlar aynı -->
            </div>
        </div>
    `;
    
    // YENİ: Paneli açmadan önce içeriğin yüksekliğini ölç
    const content = altPanel.querySelector('.panel-content');
    // Geçici olarak görünür yapıp ölçüm al ve tekrar gizle
    altPanel.style.visibility = 'hidden';
    altPanel.style.transform = 'translateY(0)'; // Ölçüm için açık pozisyona getir
    const contentHeight = content.scrollHeight + 40; // Padding vs. için pay
    altPanel.style.transform = 'translateY(100%)'; // Tekrar gizle
    altPanel.style.visibility = 'visible';
    
    openPanel(contentHeight); // Paneli ölçülen yükseklikte aç

    gorunumDegistirBtn.textContent = 'Listeyi Göster';
    attachPanelEvents();
    // ...diğer event listenerlar...
}

function showListView(filtrelenmisGorevler) {
    altPanel.classList.add('liste-acik');
    altPanel.innerHTML = `
        <div class="panel-handle"></div>
        <div class="panel-content">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <div id="gorev-listesi">
                ${filtrelenmisGorevler.map(gorev => `
                    <div class="gorev-karti" data-id="${gorev.id}">
                        <h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4>
                        <p>${gorev.tamAdres}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Liste görünümünü ekranın %50'si yükseklikte aç
    openPanel(window.innerHeight * 0.5);

    gorunumDegistirBtn.textContent = 'Haritayı Göster';
    attachPanelEvents();
    
    altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            callbacks.onGorevSelect(parseInt(e.currentTarget.dataset.id, 10));
        });
    });
}

function hidePanel() {
    altPanel.classList.remove('visible', 'liste-acik');
    altPanel.style.transform = 'translateY(100%)';
    updateControlPositions(0); // Butonları orijinal pozisyonuna döndür
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

function openPanel(height) {
    altPanel.style.height = `${height}px`;
    altPanel.classList.add('visible');
    updateControlPositions(height);
}

// YENİ: Kontrol butonlarının pozisyonunu panel yüksekliğine göre güncelleyen fonksiyon
function updateControlPositions(panelHeight) {
     if (window.innerWidth > 600) return; // Sadece mobilde çalışsın

    const bottomOffset = panelHeight + 20; // 20px boşluk
    navigationBtn.style.bottom = `${bottomOffset}px`;

    const controlsOffset = `translateY(-50%) translateY(-${panelHeight / 2}px)`;
    customControls.style.transform = controlsOffset;
}

function attachPanelEvents() {
    document.getElementById('close-btn').addEventListener('click', () => callbacks.onDeselect());
    const handle = altPanel.querySelector('.panel-handle');
    if (handle) {
        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
    }
}

// --- SÜRÜKLEME FONKSİYONLARI (GÜNCELLENDİ) ---
function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none'; // Sürüklerken animasyonu kapat
    customControls.style.transition = 'none';
    navigationBtn.style.transition = 'none';

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
    if (newHeight < 100) newHeight = 100; // Minimum yükseklik

    altPanel.style.height = `${newHeight}px`;
    updateControlPositions(newHeight); // Butonları da anlık olarak güncelle
}

function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'transform 0.4s ease-in-out'; // Animasyonu geri aç
    customControls.style.transition = 'transform 0.4s ease-in-out';
    navigationBtn.style.transition = 'bottom 0.4s ease-in-out';

    const currentHeight = altPanel.offsetHeight;
    // Eğer 150px'den daha aza indirildiyse paneli kapat
    if (currentHeight < 150) {
        callbacks.onDeselect();
    } 
    // Liste görünümünde 50vh'nin altına indiyse 50vh'ye geri çek
    else if (altPanel.classList.contains('liste-acik') && currentHeight < window.innerHeight * 0.45) {
        openPanel(window.innerHeight * 0.5);
    }

    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('touchmove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

export { showDetailView, showListView, hidePanel };
