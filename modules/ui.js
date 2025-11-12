import { config } from './config.js';
import { updateGorevStatus } from './api.js';

// Global değişkenler
const altPanel = document.getElementById('alt-panel');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');
const kalanGorevSayaci = document.getElementById('kalan-görev-sayaci');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedGorevId = null;
let mapInstance = null;
let currentAracAdi = '';
let currentRoute = null; // Haritadaki mevcut rotayı saklamak için

/**
 * UI'ı başlatır.
 */
export function initUI(gorevler, map, placemarks, aracAdi) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    hidePanel();
}

/**
 * Kullanıcının o anki konumunu alır.
 * @returns {Promise<[number, number]>} [boylam, enlem] formatında koordinatlar.
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve([position.coords.longitude, position.coords.latitude]);
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Konum izni reddedildi.'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Konum bilgisi alınamıyor.'));
                        break;
                    case error.TIMEOUT:
                        reject(new Error('Konum alma isteği zaman aşımına uğradı.'));
                        break;
                    default:
                        reject(new Error('Bilinmeyen bir hata oluştu.'));
                        break;
                }
            }
        );
    });
}

/**
 * Verilen göreve OpenRouteService kullanarak bir rota çizer.
 * @param {object} gorev 
 * @param {HTMLElement} clickedButton
 */
async function drawRoute(gorev, clickedButton) {
    const originalText = clickedButton.textContent;
    clickedButton.textContent = 'Hesaplanıyor...';
    clickedButton.disabled = true;

    // Önceki rotayı haritadan temizle
    if (currentRoute) {
        mapInstance.removeChild(currentRoute);
        currentRoute = null;
    }

    try {
        // 1. Kullanıcının ve hedefin koordinatlarını al
        const startPoint = await getUserLocation();
        const endPoint = [gorev.boylam, gorev.enlem];

        // 2. OpenRouteService API'sine POST isteği gönder
        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-Type': 'application/json',
                'Authorization': config.openRouteServiceApiKey // API anahtarını config dosyasından alıyoruz
            },
            body: JSON.stringify({
                "coordinates": [startPoint, endPoint]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `API Hatası: ${response.status}`);
        }

        const data = await response.json();
        const routeCoordinates = data.features[0].geometry.coordinates;

        // 3. Gelen rota geometrisini kullanarak Yandex haritası üzerinde bir çizgi oluştur
        const routeFeature = new ymaps3.YMapFeature({
            geometry: {
                type: 'LineString',
                coordinates: routeCoordinates
            },
            style: {
                stroke: [{ color: '#007BFF', width: 5 }] // Mavi, 5px kalınlığında
            }
        });

        currentRoute = routeFeature;
        mapInstance.addChild(currentRoute);

    } catch (error) {
        alert(`Rota çizilemedi: ${error.message}`);
    } finally {
        // 4. Butonu eski haline getir
        clickedButton.textContent = originalText;
        clickedButton.disabled = false;
    }
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

    document.getElementById('close-btn').addEventListener('click', deselectGorev);
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    if (gorev.telefon) {
        document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
    }
    const deliveredBtn = document.getElementById('delivered-btn');
    deliveredBtn.addEventListener('click', (e) => handleStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));
    const notHomeBtn = document.getElementById('not-home-btn');
    notHomeBtn.addEventListener('click', (e) => handleStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));

    // Rota çizme butonuna olay dinleyicisi ekle
    const routeBtn = document.getElementById('route-btn');
    routeBtn.addEventListener('click', (e) => drawRoute(gorev, e.target));
}


/**
 * Tüm seçimleri temizler ve paneli gizler. Varsa rotayı da temizler.
 */
function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    // Paneli kapatırken rotayı da temizle
    if (currentRoute) {
        mapInstance.removeChild(currentRoute);
        currentRoute = null;
    }
    hidePanel();
}

// ---- Diğer Fonksiyonlar (Bu kısımlarda değişiklik yok, tamlık için eklendi) ----

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    const confirmationMessage = `${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`;
    if (!confirm(confirmationMessage)) return;
    const originalText = clickedButton.textContent;
    const allButtons = clickedButton.parentElement.querySelectorAll('button');
    allButtons.forEach(btn => btn.disabled = true);
    clickedButton.textContent = 'İşleniyor...';
    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Görev durumu güncellenemedi. Lütfen tekrar deneyin.');
        allButtons.forEach(btn => btn.disabled = false);
        clickedButton.textContent = originalText;
    }
}

function removeGorev(gorevId) {
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        mapInstance.removeChild(pin.marker);
        placemarksMap.delete(gorevId);
    }
    gorevlerData = gorevlerData.filter(g => g.id !== gorevId);
    kalanGorevSayaci.textContent = `Kalan: ${gorevlerData.length}`;
    deselectGorev();
    if (altPanel.classList.contains('liste-acik')) {
        showListView(mahalleFiltresi.value);
    }
}

function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
}

function setupEventListeners() {
    const mapContainer = mapInstance.container;
    const mapListener = new ymaps3.YMapListener({
        layer: 'any',
        onMouseEnter: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'pointer'; },
        onMouseLeave: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'grab'; },
        onPointerDown: (event) => {
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                selectGorev(gorevId);
            }
        }
    });
    mapInstance.addChild(mapListener);
    mahalleFiltresi.addEventListener('change', () => showListView(mahalleFiltresi.value));
    gorunumDegistirBtn.addEventListener('click', () => altPanel.classList.contains('liste-acik') ? hidePanel() : showListView());
}

function selectGorev(gorevId) {
    if (currentSelectedGorevId) placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);
    if (!gorev || !pin) return;
    pin.element.classList.add('selected');
    showDetailView(gorev);
}

function hidePanel() {
    altPanel.style.display = 'none';
    altPanel.classList.remove('liste-acik');
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

function showListView(mahalleFilter = 'TÜMÜ') {
    altPanel.classList.add('liste-acik');
    filterPinsOnMap(mahalleFilter);
    const filtrelenmisGorevler = gorevlerData.filter(gorev => mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter);
    altPanel.innerHTML = `<div id="gorev-listesi">${filtrelenmisGorevler.map(gorev => `<div class="gorev-karti ${gorev.hasCoords ? '' : 'no-coords'}" data-id="${gorev.id}"><h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4><p>${gorev.tamAdres}</p>${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}</div>`).join('')}</div>`;
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

function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (gorev) pin.element.classList.toggle('filtered-out', !(secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle));
    });
}
