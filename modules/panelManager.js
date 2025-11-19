// DOSYA: modules/panelManager.js

const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let callbacks = {}; 

export function initPanelManager(cbs) {
    callbacks = cbs;
    gorunumDegistirBtn.addEventListener('click', () => {
        // Eğer panelde 'sheet-content' varsa liste açıktır
        if (altPanel.querySelector('.gorev-list-item')) {
            callbacks.onDeselect();
        } else {
            callbacks.onShowListView();
        }
    });
}

export function showDetailView(gorev) {
    altPanel.style.display = 'flex'; // Görünür yap
    altPanel.classList.add('panel-open');
    
    // Stitch tasarımındaki GRID YAPISI burada uygulanıyor
    altPanel.innerHTML = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <div>
                    <h2>${gorev.adSoyad} (${gorev.miktar})</h2>
                    <p>${gorev.tamAdres}</p>
                    ${gorev.adresNotu ? `<p style="color:#d97706; font-size:0.8rem; margin-top:4px;">Not: ${gorev.adresNotu}</p>` : ''}
                </div>
                <button id="close-panel-btn" class="close-btn-mini">
                    <span class="material-icons-outlined">close</span>
                </button>
            </div>

            <div class="action-grid">
                <button id="nav-btn" class="action-btn">
                    <span class="material-icons-outlined">navigation</span>
                    <span class="label">Navigasyon</span>
                </button>
                <button id="route-btn" class="action-btn">
                    <span class="material-icons-outlined">alt_route</span>
                    <span class="label">Rota Çiz</span>
                </button>
                <button id="delivered-btn" class="action-btn btn-green">
                    <span class="material-icons-outlined">check_circle</span>
                    <span class="label">Verildi</span>
                </button>
                <button id="not-home-btn" class="action-btn btn-red">
                    <span class="material-icons-outlined">home</span>
                    <span class="label">Evde Yok</span>
                </button>
                ${gorev.telefon ? `
                <button id="call-btn" class="action-btn">
                    <span class="material-icons-outlined">call</span>
                    <span class="label">Ara</span>
                </button>` : ''}
            </div>
        </div>
    `;

    // Event Listenerlar
    document.getElementById('close-panel-btn').addEventListener('click', () => callbacks.onDeselect());
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    document.getElementById('route-btn').addEventListener('click', (e) => callbacks.onRouteClick(gorev, document.getElementById('route-btn'))); // butonu parametre olarak geçiriyoruz
    document.getElementById('delivered-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.currentTarget));
    document.getElementById('not-home-btn').addEventListener('click', (e) => callbacks.onStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.currentTarget));
    
    if (gorev.telefon) {
        document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
    }

    // Panel açıldığında FAB butonunu yukarı itmek için
    adjustFabPosition(true);
}

export function showListView(filtrelenmisGorevler) {
    altPanel.style.display = 'flex';
    altPanel.classList.add('panel-open');

    altPanel.innerHTML = `
        <div class="sheet-handle"></div>
        <div class="sheet-content">
            <div class="detail-header">
                <h2 style="font-size:1rem;">Görev Listesi (${filtrelenmisGorevler.length})</h2>
                <button id="close-list-btn" class="close-btn-mini">
                    <span class="material-icons-outlined">close</span>
                </button>
            </div>
            <div id="list-container" style="max-height: 50vh; overflow-y: auto;">
                ${filtrelenmisGorevler.map(gorev => `
                    <div class="gorev-list-item" data-id="${gorev.id}">
                        <h4>${gorev.adSoyad} (${gorev.miktar})</h4>
                        <p>${gorev.mahalle} - ${gorev.tamAdres.substring(0, 30)}...</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('close-list-btn').addEventListener('click', () => callbacks.onDeselect());

    altPanel.querySelectorAll('.gorev-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.dataset.id);
            callbacks.onGorevSelect(id);
        });
    });

    adjustFabPosition(true);
}

export function hidePanel() {
    altPanel.style.display = 'none';
    altPanel.classList.remove('panel-open');
    altPanel.innerHTML = ''; // Temizle
    adjustFabPosition(false);
}

// FAB Butonunu panel yüksekliğine göre ayarlayan küçük yardımcı
function adjustFabPosition(isOpen) {
    const fab = document.getElementById('navigation-toggle-btn');
    if (!fab) return;
    
    if (isOpen) {
        // CSS class ile yönetmek daha performanslı
        fab.style.transform = 'translateY(-300px)'; // Kabaca panel yüksekliği kadar yukarı
    } else {
        fab.style.transform = 'translateY(0)';
    }
}
