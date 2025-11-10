// Global değişkenler ve seçiciler
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
};

/**
 * Harita ve pinler için tıklama olaylarını ayarlar.
 * @param {YMap} map 
 */
function setupEventListeners(map) {
    // Tüm harita olaylarını dinlemek için tek bir YMapListener oluşturuyoruz.
    const mapListener = new ymaps3.YMapListener({
        layer: 'any', // Hem harita zeminini hem de özellikleri dinle

        // Fare/parmak bir marker'ın üzerine geldiğinde (isteğe bağlı, imleci değiştirebilir)
        onMouseEnter: (object) => {
            if (object.entity?.element?.classList.contains('placemark')) {
                map.setCursor('pointer');
            }
        },

        // Fare/parmak bir marker'ın üzerinden ayrıldığında (isteğe bağlı)
        onMouseLeave: (object) => {
            if (object.entity?.element?.classList.contains('placemark')) {
                map.setCursor('grab');
            }
        },

        // Haritanın herhangi bir yerine tıklandığında/dokunulduğunda
        onPointerDown: (event, point) => {
            // Eğer bir marker'a tıklandıysa (event.entity doluysa)
            if (event.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                handlePinClick(gorevId);
            } 
            // Eğer bir marker'a tıklanmadıysa (yani event.entity boşsa) seçimi temizle
            else {
                clearSelection();
            }
        }
    });

    // Oluşturduğumuz dinleyiciyi haritaya ekliyoruz.
    map.addChild(mapListener);
}

    // Haritanın boş bir yerine tıklandığında seçimi temizle
    const mapListener = new ymaps3.YMapListener({
        layer: 'any',
        onPointerDown: (event, point) => {
            // Eğer bir marker'a tıklanmadıysa (yani event.entity boşsa) seçimi temizle
            if (!event.entity) {
                clearSelection();
            }
        }
    });
    map.addChild(mapListener);
};

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
