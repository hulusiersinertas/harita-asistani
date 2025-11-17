// Alt panelin (detay ve liste görünümleri) yönetimiyle ilgili tüm mantığı içerir.

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {}; // Olayları ana UI modülüne bildirmek için

// YENİ EKLENDİ: Sürükleme durumu için değişkenler
let isDragging = false;
let startY = 0;
let startHeight = 0;

export function initPanelManager(cbs) {
    callbacks = cbs;
    gorunumDegistirBtn.addEventListener('click', () => {
        if (altPanel.classList.contains('liste-acik')) {
            callbacks.onDeselect();
        } else {
            callbacks.onShowListView();
        }
    });
}

function showDetailView(gorev) {
    altPanel.classList.remove('liste-acik');
    // GÜNCELLENDİ: Tutamaç ve içerik sarmalayıcı eklendi
    altPanel.innerHTML = `
        <div class="panel-handle"></div>
        <div class="panel-content" id="gorev-detay-content">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
            ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
            <p>${gorev.tamAdres}</p>
            <div class="action-buttons">
                <button id="nav-btn">Navigasyon</button>
                <button id="route-btn">Rota Çiz</button>
                <button id="delivered-btn" class="status-btn">Verildi</button>
                <button id="not-home-btn" class="status-btn">Evde Yok</button>
                ${gorev.telefon ? `<button id="call-btn">Ara</button>` : ''}
            </div>
        </div>
    `;
    // GÜNCELLENDİ: Paneli açmak için class ve height kullanılıyor
    altPanel.style.display = 'flex';
    // Kısa bir gecikme ile class ekleyerek CSS transition'ını tetikle
    setTimeout(() => {
        altPanel.classList.add('visible');
        // Detay panelinin yüksekliğini içeriğine göre ayarla
        const contentHeight = document.getElementById('gorev-detay-content').offsetHeight;
        altPanel.style.height = `${contentHeight + 25}px`;
    }, 10);

    gorunumDegistirBtn.textContent = 'Listeyi Göster';
    attachPanelEvents(); // Olay dinleyicilerini ekle

    document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));
    document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));
    if (gorev.telefon) {
        document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
    }
}

function showListView(filtrelenmisGorevler) {
    altPanel.classList.add('liste-acik');
    // GÜNCELLENDİ: Tutamaç ve içerik sarmalayıcı eklendi
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
    // GÜNCELLENDİ: Paneli açmak için class ve height kullanılıyor
    altPanel.style.display = 'flex';
    setTimeout(() => altPanel.classList.add('visible'), 10);
    
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
    attachPanelEvents(); // Olay dinleyicilerini ekle

    altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            callbacks.onGorevSelect(parseInt(e.currentTarget.dataset.id, 10));
        });
    });
}

function hidePanel() {
    // GÜNCELLENDİ: Paneli kapatmak için class ve height kullanılıyor
    altPanel.classList.remove('visible', 'liste-acik');
    altPanel.style.height = '0px';
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
    // Animasyon bittikten sonra display:none yapmak performansı artırır
    setTimeout(() => {
        if (altPanel.style.height === '0px') {
            altPanel.style.display = 'none';
        }
    }, 400); // Transition süresiyle aynı olmalı
}

// YENİ EKLENDİ: Tüm panel olaylarını (kapatma, sürükleme) bağlayan fonksiyon
function attachPanelEvents() {
    document.getElementById('close-btn').addEventListener('click', () => callbacks.onDeselect());

    const handle = altPanel.querySelector('.panel-handle');
    if (handle) {
        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
    }
}

// --- YENİ SÜRÜKLEME FONKSİYONLARI ---
function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startHeight = altPanel.offsetHeight;
    altPanel.style.transition = 'none'; // Sürüklerken animasyonu kapat

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

    // Sınırları belirle
    const maxHeight = window.innerHeight * 0.85;
    if (newHeight > maxHeight) newHeight = maxHeight;

    altPanel.style.height = `${newHeight}px`;
}

function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    altPanel.style.transition = 'height 0.4s ease-in-out'; // Animasyonu geri aç

    // Eğer yeterince aşağı sürüklendiyse paneli kapat
    const currentHeight = altPanel.offsetHeight;
    if (currentHeight < startHeight * 0.7 && currentHeight < 250) {
        callbacks.onDeselect();
    } 
    // Liste görünümünde 50vh'nin altına indiyse 50vh'ye geri çek
    else if (altPanel.classList.contains('liste-acik') && currentHeight < window.innerHeight * 0.5) {
        altPanel.style.height = '50vh';
    }

    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('touchmove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

// Orijinal fonksiyonlar buraya taşındı, artık attachPanelEvents içinde yönetiliyor
export { showDetailView, showListView, hidePanel };
