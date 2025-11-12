// Global değişkenler ve DOM elementleri
const gorevDetayPanel = document.getElementById('gorev-detay');
const gorevListesiPanel = document.getElementById('gorev-listesi');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const altPanel = document.getElementById('alt-panel');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedPin = null;
let mapInstance = null; // Harita nesnesini saklamak için

/**
 * Kullanıcı arayüzünü (UI) başlatır ve olay dinleyicilerini ayarlar.
 */
export function initUI(gorevler, map, placemarks) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map; // Harita nesnesini global olarak erişilebilir yap

    populateMahalleFiltresi(gorevler);
    setupEventListeners();
}

/**
 * Benzersiz mahalle isimlerini toplayıp filtre menüsünü doldurur.
 */
function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set();
    gorevler.forEach(gorev => {
        if (gorev.mahalle) mahalleler.add(gorev.mahalle);
    });
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    sortedMahalleler.forEach(mahalle => {
        const option = document.createElement('option');
        option.value = mahalle;
        option.textContent = mahalle;
        mahalleFiltresi.appendChild(option);
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
        onMouseEnter: (object) => {
            if (object && object.entity?.element?.classList.contains('placemark')) {
                mapContainer.style.cursor = 'pointer';
            }
        },
        onMouseLeave: (object) => {
            if (object && object.entity?.element?.classList.contains('placemark')) {
                mapContainer.style.cursor = 'grab';
            }
        },
        onPointerDown: (event) => {
            if (event && event.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                handlePinClick(gorevId);
            } else {
                clearSelection();
            }
        }
    });
    mapInstance.addChild(mapListener);

    mahalleFiltresi.addEventListener('change', () => {
        filterGorevler(mahalleFiltresi.value);
    });

    gorunumDegistirBtn.addEventListener('click', () => {
        toggleGorevListesi();
    });
}

/**
 * Seçilen mahalleye göre görevleri filtreler.
 */
function filterGorevler(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (!gorev) return;

        if (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle) {
            pin.element.classList.remove('filtered-out');
            pin.marker.update({ Mappable: true });
        } else {
            pin.element.classList.add('filtered-out');
        }
    });

    if (altPanel.classList.contains('liste-acik')) {
        renderGorevListesi(secilenMahalle);
    }
}

/**
 * Alt paneldeki liste ve detay görünümü arasında geçiş yapar.
 */
function toggleGorevListesi(forceState) {
    const isCurrentlyOpen = altPanel.classList.contains('liste-acik');
    const shouldBeOpen = forceState === undefined ? !isCurrentlyOpen : forceState;

    if (shouldBeOpen) {
        altPanel.classList.add('liste-acik');
        gorunumDegistirBtn.textContent = 'Haritayı Göster';
        gorevDetayPanel.classList.add('hidden');
        gorevListesiPanel.classList.remove('hidden');
        renderGorevListesi(mahalleFiltresi.value);
    } else {
        altPanel.classList.remove('liste-acik');
        gorunumDegistirBtn.textContent = 'Listeyi Göster';
        gorevDetayPanel.classList.remove('hidden');
        gorevListesiPanel.classList.add('hidden');
        clearSelection();
    }
}

/**
 * Görev listesini HTML olarak oluşturur ve panale ekler.
 */
function renderGorevListesi(mahalleFilter) {
    let listHTML = '';
    const filtrelenmisGorevler = gorevlerData.filter(gorev => 
        mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter
    );

    filtrelenmisGorevler.forEach(gorev => {
        listHTML += `
            <div class="gorev-karti ${gorev.hasCoords ? '' : 'no-coords'}" data-id="${gorev.id}">
                <h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4>
                <p>${gorev.tamAdres}</p>
                ${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}
            </div>
        `;
    });

    gorevListesiPanel.innerHTML = listHTML;

    document.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            const gorev = gorevlerData.find(g => g.id === gorevId);
            
            if (gorev && gorev.hasCoords) {
                toggleGorevListesi(false);
                mapInstance.update({
                    location: {
                        center: [gorev.boylam, gorev.enlem],
                        zoom: 17,
                        duration: 500
                    }
                });
                handlePinClick(gorevId);
            } else {
                alert('Bu görevin koordinat bilgisi bulunmuyor, haritada gösterilemez.');
            }
        });
    });
}

/**
 * Bir pine tıklandığında çalışacak fonksiyon.
 */
function handlePinClick(gorevId) {
    if (altPanel.classList.contains('liste-acik')) {
        toggleGorevListesi(false);
    }
    
    clearSelection();
    
    const pin = placemarksMap.get(gorevId);
    if (pin && pin.element) {
        pin.element.classList.add('selected');
        currentSelectedPin = pin;
    }
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev) {
        showGorevDetay(gorev);
    }
}

/**
 * Alt panelde seçilen görevin detaylarını gösterir.
 */
function showGorevDetay(gorev) {
    gorevDetayPanel.innerHTML = `
        <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
        ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
        <p>${gorev.tamAdres}</p>
        <div class="action-buttons">
            <button>Navigasyon</button>
            <button>Rota Çiz</button>
            <button>Verildi</button>
            <button>Evde Yok</button>
            ${gorev.telefon ? `<button>Ara</button>` : ''}
        </div>
    `;
}

/**
 * Seçili olan pini ve detay panelini temizler.
 */
function clearSelection() {
    if (currentSelectedPin && currentSelectedPin.element) {
        currentSelectedPin.element.classList.remove('selected');
    }
    currentSelectedPin = null;
    gorevDetayPanel.innerHTML = '<p class="placeholder">Detayları görmek için haritadan bir nokta seçin.</p>';
}
