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
            if (event.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                handlePinClick(gorevId);
            } else {
                clearSelection();
            }
        }
    });
    mapInstance.addChild(mapListener);

    // Mahalle filtresi değiştiğinde
    mahalleFiltresi.addEventListener('change', () => {
        filterGorevler(mahalleFiltresi.value);
    });

    // Görünüm değiştirme butonu
    gorunumDegistirBtn.addEventListener('click', toggleGorevListesi);
}

/**
 * Seçilen mahalleye göre görevleri filtreler.
 * @param {string} secilenMahalle 
 */
function filterGorevler(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (!gorev) return;

        // "TÜMÜ" seçiliyse veya görev mahalleye uyuyorsa pini göster
        if (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle) {
            pin.element.classList.remove('filtered-out');
            pin.marker.update({ Mappable: true }); // Marker'ı görünür yap (API V3 için)
        } else {
        // Değilse, pini filtrele (soluk sarı yap)
            pin.element.classList.add('filtered-out');
            // pin.marker.update({ Mappable: false }); // Alternatif: Marker'ı tamamen gizle
        }
    });
    // Liste görünümü açıksa, listeyi de filtrele
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
        // Listeyi Aç
        altPanel.classList.add('liste-acik');
        gorunumDegistirBtn.textContent = 'Haritayı Göster';
        gorevDetayPanel.classList.add('hidden');
        gorevListesiPanel.classList.remove('hidden');
        renderGorevListesi(mahalleFiltresi.value);
    } else {
        // Listeyi Kapat
        altPanel.classList.remove('liste-acik');
        gorunumDegistirBtn.textContent = 'Listeyi Göster';
        gorevDetayPanel.classList.remove('hidden');
        gorevListesiPanel.classList.add('hidden');
        
        // --- KRİTİK DEĞİŞİKLİK BURADA ---
        // Liste kapandığında, seçimi temizle fonksiyonunu çağırarak 
        // alt panelin içeriğini varsayılan placeholder'a döndürüyoruz.
        clearSelection(); 
    }
}
2. handlePinClick Fonksiyonunu Güncelleyin
Bu fonksiyonun listeyle ilgili hiçbir işi olmaması gerekir, o sadece harita ve alt panelin detay kısmı ile ilgilenir.
code
JavaScript
/**
 * Bir pine tıklandığında çalışacak fonksiyon.
 * @param {number} gorevId 
 */
function handlePinClick(gorevId) {
    // Önce listeyi kapat (Eğer açıksa ve kullanıcı haritadan tıklama yaptıysa)
    if (altPanel.classList.contains('liste-acik')) {
        toggleGorevListesi(false);
    }
    
    // Şimdi seçimi temizle ve yeni seçimi göster
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
 * Görev listesini HTML olarak oluşturur ve panale ekler.
 * @param {string} mahalleFilter 
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

    // Oluşturulan her kart için tıklama olayı ekle
    document.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            const gorev = gorevlerData.find(g => g.id === gorevId);
            
            if (gorev && gorev.hasCoords) {
                // Harita görünümüne geri dön
                toggleGorevListesi();

                // Haritayı pine odakla
                mapInstance.update({
                    location: {
                        center: [gorev.boylam, gorev.enlem],
                        zoom: 17, // Daha yakın bir zoom
                        duration: 500 // Animasyon süresi
                    }
                });
                
                // Pini seç ve detayları göster
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
