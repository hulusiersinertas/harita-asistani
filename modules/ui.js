// Global değişkenler ve DOM elementleri
const altPanel = document.getElementById('alt-panel');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
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
    hidePanel();
}

/**
 * Mahalle filtresini doldurur.
 */
function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
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
        onMouseEnter: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'pointer'; },
        onMouseLeave: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'grab'; },
        onPointerDown: (event) => {
            // --- DEĞİŞİKLİK BURADA ---
            // Sadece bir placemark'a tıklandığında işlem yap. Boşluğa tıklamayı Yoksay.
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                selectGorev(gorevId);
            }
        }
    });
    mapInstance.addChild(mapListener);

    mahalleFiltresi.addEventListener('change', () => showListView(mahalleFiltresi.value));
    gorunumDegistirBtn.addEventListener('click', () => {
        const isListeAcik = altPanel.classList.contains('liste-acik');
        isListeAcik ? hidePanel() : showListView();
    });
}

/**
 * Belirli bir görevi seçer ve detay görünümünü gösterir.
 */
function selectGorev(gorevId) {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    }
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);
    if (!gorev || !pin) return;

    pin.element.classList.add('selected');
    showDetailView(gorev);
}

/**
 * Tüm seçimleri temizler ve paneli gizler.
 */
function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
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
function showDetailView(gorev) {
    altPanel.classList.remove('liste-acik');
    altPanel.innerHTML = `
        <div id="gorev-detay">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
            ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
            <p>${gorev.tamAdres}</p>
            <div class="action-buttons">
                <button>Navigasyon</button> <button>Rota Çiz</button> <button>Verildi</button>
                <button>Evde Yok</button> ${gorev.telefon ? `<button>Ara</button>` : ''}
            </div>
        </div>
    `;
    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Listeyi Göster';

    // Yeni eklenen kapatma butonuna olay dinleyicisini bağla
    document.getElementById('close-btn').addEventListener('click', deselectGorev);
}

/**
 * Alt paneli büyük (liste) modunda gösterir.
 */
function showListView(mahalleFilter = 'TÜMÜ') {
    altPanel.classList.add('liste-acik');
    filterPinsOnMap(mahalleFilter);

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
    altPanel.innerHTML = `<div id="gorev-listesi">${listHTML}</div>`;
    
    altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            const gorev = gorevlerData.find(g => g.id === gorevId);
            if (gorev?.hasCoords) {
                mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 17, duration: 500 } });
                selectGorev(gorevId);
            } else {
                alert('Bu görevin koordinat bilgisi bulunmuyor.');
            }
        });
    });

    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
}

/**
 * Haritadaki pinleri mahalleye göre filtreler.
 */
function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (gorev) {
            const shouldBeVisible = secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle;
            pin.element.classList.toggle('filtered-out', !shouldBeVisible);
        }
    });
}
