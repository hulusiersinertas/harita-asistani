// Alt panelin (detay ve liste görünümleri) yönetimiyle ilgili tüm mantığı içerir.

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {}; // Olayları ana UI modülüne bildirmek için

/**
 * Panel yöneticisini başlatır ve gerekli callback'leri ayarlar.
 */
export function initPanelManager(cbs) {
    callbacks = cbs; // onGorevSelect, onStatusUpdate vb.
    gorunumDegistirBtn.addEventListener('click', () => {
        if (altPanel.classList.contains('liste-acik')) {
            // "Haritayı Göster" butonu aslında paneli kapatma işlevi görüyor.
            callbacks.onDeselect();
        } else {
            callbacks.onShowListView();
        }
    });
}

/**
 * Görev detay görünümünü oluşturur ve gösterir.
 */
export function showDetailView(gorev) {
    altPanel.classList.remove('liste-acik');
    altPanel.innerHTML = `
        <div id="gorev-detay">
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
    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Listeyi Göster';

    // Olay dinleyicilerini callback'lere bağla
    document.getElementById('close-btn').addEventListener('click', () => callbacks.onDeselect());
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, e.target));
    document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));
    document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));
    if (gorev.telefon) {
        document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
    }
}

/**
 * Görev listesi görünümünü oluşturur ve gösterir.
 */
export function showListView(filtrelenmisGorevler) {
    altPanel.classList.add('liste-acik');
    // GÜNCELLENDİ: Liste görünümüne de "Kapat" butonu eklendi.
    altPanel.innerHTML = `
        <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
        <div id="gorev-listesi">
            ${filtrelenmisGorevler.map(gorev => `
                <div class="gorev-karti ${gorev.hasCoords ? '' : 'no-coords'}" data-id="${gorev.id}">
                    <h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4>
                    <p>${gorev.tamAdres}</p>
                    ${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}
                </div>
            `).join('')}
        </div>
    `;

    // GÜNCELLENDİ: Hem görev kartlarına hem de yeni eklenen kapat butonuna olay dinleyicisi atanıyor.
    document.getElementById('close-btn').addEventListener('click', () => callbacks.onDeselect());
    
    altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            callbacks.onGorevSelect(gorevId);
        });
    });

    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
}

/**
 * Alt paneli tamamen gizler.
 */
export function hidePanel() {
    altPanel.style.display = 'none';
    altPanel.classList.remove('liste-acik');
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}
