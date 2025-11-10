// Global değişkenler ve DOM elementleri
const gorevDetayPanel = document.getElementById('gorev-detay');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedPin = null;

/**
 * Kullanıcı arayüzünü (UI) başlatır ve olay dinleyicilerini ayarlar.
 * @param {Array} gorevler - Tüm görevlerin verileri.
 * @param {YMap} map - Yandex harita nesnesi.
 * @param {Map} placemarks - Görev ID'lerini marker'lara eşleyen Map nesnesi.
 */
export function initUI(gorevler, map, placemarks) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;

    populateMahalleFiltresi(gorevler);
    setupEventListeners(map);
}

/**
 * Benzersiz mahalle isimlerini toplayıp filtre menüsünü doldurur.
 * @param {Array} gorevler 
 */
function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(); // Set, otomatik olarak benzersiz değerler tutar.
    gorevler.forEach(gorev => {
        if (gorev.mahalle) {
            mahalleler.add(gorev.mahalle);
        }
    });

    // Set'i alfabetik olarak sıralanmış bir diziye dönüştür
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));

    sortedMahalleler.forEach(mahalle => {
        const option = document.createElement('option');
        option.value = mahalle;
        option.textContent = mahalle;
        mahalleFiltresi.appendChild(option);
    });

    mahalleFiltresi.disabled = false; // Filtreyi aktif et
}

/**
 * Harita ve pinler için tıklama olaylarını ayarlar.
 * @param {YMap} map 
 */
function setupEventListeners(map) {
    const mapListener = new ymaps3.YMapListener({
        layer: 'any', 

        onMouseEnter: (object) => {
            // --- HATA DÜZELTME 1 ---
            // Önce 'object' var mı diye kontrol et, sonra devam et.
            if (object && object.entity?.element?.classList.contains('placemark')) {
                map.setCursor('pointer');
            }
        },

        onMouseLeave: (object) => {
            // --- HATA DÜZELTME 2 ---
            // Burada da 'object' var mı diye kontrol et.
            if (object && object.entity?.element?.classList.contains('placemark')) {
                map.setCursor('grab');
            }
        },

        onPointerDown: (event) => {
            if (event.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                handlePinClick(gorevId);
            } 
            else {
                clearSelection();
            }
        }
    });
    
    map.addChild(mapListener);
}


/**
 * Bir pine tıklandığında çalışacak fonksiyon.
 * @param {number} gorevId 
 */
function handlePinClick(gorevId) {
    // Önceki seçimi temizle
    clearSelection();

    // Yeni pini seçili olarak işaretle
    const pin = placemarksMap.get(gorevId);
    if (pin && pin.element) {
        pin.element.classList.add('selected');
        currentSelectedPin = pin;
    }

    // Alt panelde görev detaylarını göster
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev) {
        showGorevDetay(gorev);
    }
}

/**
 * Alt panelde seçilen görevin detaylarını gösterir.
 * @param {Object} gorev 
 */
function showGorevDetay(gorev) {
    gorevDetayPanel.innerHTML = `
        <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
        ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
        <p>${gorev.tamAdres}</p>
        <div class="action-buttons">
            <!-- Butonlar bir sonraki adımda eklenecek -->
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
