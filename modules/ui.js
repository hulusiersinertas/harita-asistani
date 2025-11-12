// Global değişkenler ve DOM elementleri
const gorevDetayPanel = document.getElementById('gorev-detay');
const gorevListesiPanel = document.getElementById('gorev-listesi');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedGorevId = null;
let mapInstance = null;

/**
 * UI'ı başlatır.
 */
export function initUI(gorevler, map, placemarks) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    // Başlangıçta alt paneli gizli yapalım
    altPanel.style.display = 'none';
}

/**
 * Mahalle filtresini doldurur.
 */
function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));

    sortedMahalleler.forEach(mahalle => {
        const option = new Option(mahalle, mahalle);
        mahalleFiltresi.add(option);
    });
    mahalleFiltresi.disabled = false;
}

/**
 * Tüm olay dinleyicilerini ayarlar.
 */
function setupEventListeners() {
    const mapContainer = mapInstance.container;

    const mapListener = new ymaps3.YMapListener({
        layer: 'any',
        onMouseEnter: (obj) => {
            if (obj && obj.entity?.element?.classList.contains('placemark')) {
                mapContainer.style.cursor = 'pointer';
            }
        },
        onMouseLeave: (obj) => {
            if (obj && obj.entity?.element?.classList.contains('placemark')) {
                mapContainer.style.cursor = 'grab';
            }
        },
        onPointerDown: (event) => {
            if (event && event.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                selectGorev(gorevId);
            } else {
                deselectGorev();
            }
        }
    });
    mapInstance.addChild(mapListener);

    mahalleFiltresi.addEventListener('change', () => {
        showListView(mahalleFiltresi.value);
    });

    gorunumDegistirBtn.addEventListener('click', () => {
        const isListeAcik = altPanel.classList.contains('liste-acik');
        if (isListeAcik) {
            hidePanel();
        } else {
            showListView(); // Filtre seçili değilse tümünü gösterir
        }
    });
}

/**
 * Belirli bir görevi seçer ve detay görünümünü gösterir.
 * @param {number} gorevId 
 */
function selectGorev(gorevId) {
    // Önceki seçimi temizle (sadece görsel olarak)
    if (currentSelectedGorevId) {
        const previousPin = placemarksMap.get(currentSelectedGorevId);
        previousPin?.element.classList.remove('selected');
    }

    // Yeni seçimi yap
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) return;

    // Pini mora çevir
    pin.element.classList.add('selected');

    // Detay panelinin içeriğini doldur
    gorevDetayPanel.innerHTML = `
        <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
        ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
        <p>${gorev.tamAdres}</p>
        <div class="action-buttons">
            <button>Navigasyon</button> <button>Rota Çiz</button> <button>Verildi</button>
            <button>Evde Yok</button> ${gorev.telefon ? `<button>Ara</button>` : ''}
        </div>
    `;
    
    showDetailView();
}

/**
 * Tüm seçimleri temizler ve paneli gizler.
 */
function deselectGorev() {
    if (currentSelectedGorevId) {
        const previousPin = placemarksMap.get(currentSelectedGorevId);
        previousPin?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    hidePanel();
}

/**
 * Alt paneli tamamen gizler.
 */
function hidePanel() {
    altPanel.style.display = 'none';
    altPanel.classList.remove('liste-acik');
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

/**
 * Alt paneli küçük (detay) modunda gösterir.
 */
function showDetailView() {
    altPanel.style.display = 'block';
    altPanel.classList.remove('liste-acik');
    gorevDetayPanel.classList.remove('hidden');
    gorevListesiPanel.classList.add('hidden');
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

/**
 * Alt paneli büyük (liste) modunda gösterir.
 * @param {string} [mahalleFilter='TÜMÜ']
 */
function showListView(mahalleFilter = 'TÜMÜ') {
    altPanel.style.display = 'block';
    altPanel.classList.add('liste-acik');
    gorevDetayPanel.classList.add('hidden');
    gorevListesiPanel.classList.remove('hidden');
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
    
    renderGorevListesi(mahalleFilter);
    filterPinsOnMap(mahalleFilter);
}

/**
 * Haritadaki pinleri mahalleye göre filtreler (görsel olarak).
 * @param {string} secilenMahalle 
 */
function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (!gorev) return;

        if (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle) {
            pin.element.classList.remove('filtered-out');
        } else {
            pin.element.classList.add('filtered-out');
        }
    });
}

/**
 * Görev listesini HTML olarak oluşturur ve panele ekler.
 * @param {string} mahalleFilter 
 */
function renderGorevListesi(mahalleFilter) {
    const filtrelenmisGorevler = gorevlerData.filter(gorev => 
        mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter
    );

    let listHTML = filtrelenmisGorevler.map(gorev => `
        <div class="gorev-karti ${gorev.hasCoords ? '' : 'no-coords'}" data-id="${gorev.id}">
            <h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4>
            <p>${gorev.tamAdres}</p>
            ${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}
        </div>
    `).join('');

    gorevListesiPanel.innerHTML = listHTML;

    gorevListesiPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            const gorev = gorevlerData.find(g => g.id === gorevId);
            
            if (gorev && gorev.hasCoords) {
                mapInstance.update({
                    location: {
                        center: [gorev.boylam, gorev.enlem],
                        zoom: 17,
                        duration: 500
                    }
                });
                selectGorev(gorevId); // Sadece bu fonksiyonu çağırmak yeterli
            } else {
                alert('Bu görevin koordinat bilgisi bulunmuyor, haritada gösterilemez.');
            }
        });
    });
}
