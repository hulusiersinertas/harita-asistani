// ================================================================================
// DOSYA YOLU: modules/ui.js (BU KODUN TAMAMINI KOPYALAYIP MEVCUT DOSYAYLA DEĞİŞTİRİN)
// ================================================================================
import { config } from './config.js';
import { updateGorevStatus } from './api.js';

// Global değişkenler
const altPanel = document.getElementById('alt-panel');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedGorevId = null;
let mapInstance = null;
let currentAracAdi = '';
let currentRoute = null;

// ================================================================================
// YENİ EKLENEN YARDIMCI FONKSİYON: ENCODED POLYLINE ÇÖZÜCÜ
// ================================================================================
/**
 * OpenRouteService'den gelen sıkıştırılmış rota metnini (encoded polyline)
 * koordinat dizisine dönüştürür.
 * @param {string} encoded - Sıkıştırılmış rota metni.
 * @returns {Array<[number, number]>} - [[boylam, enlem], ...] formatında koordinat dizisi.
 */
function decodePolyline(encoded) {
    let points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        // Koordinatları [boylam, enlem] formatında ekliyoruz.
        points.push([lng / 1e5, lat / 1e5]);
    }
    return points;
}
// ================================================================================

export function initUI(gorevler, map, placemarks, aracAdi) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;
    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    hidePanel();
}

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
                let message = 'Bilinmeyen bir hata oluştu.';
                if (error.code === error.PERMISSION_DENIED) message = 'Konum izni reddedildi.';
                if (error.code === error.POSITION_UNAVAILABLE) message = 'Konum bilgisi alınamıyor.';
                if (error.code === error.TIMEOUT) message = 'Konum alma isteği zaman aşımına uğradı.';
                reject(new Error(message));
            }
        );
    });
}

async function drawRoute(gorev, clickedButton) {
    const originalText = clickedButton.textContent;
    clickedButton.textContent = 'Hesaplanıyor...';
    clickedButton.disabled = true;

    if (currentRoute) {
        mapInstance.removeChild(currentRoute);
        currentRoute = null;
    }

    try {
        const startPoint = await getUserLocation();
        const endPoint = [gorev.boylam, gorev.enlem];

        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-Type': 'application/json',
                'Authorization': config.openRouteServiceApiKey
            },
            body: JSON.stringify({ "coordinates": [startPoint, endPoint] })
        });

        const data = await response.json();
        console.log("OpenRouteService Yanıtı:", data);

        if (data.routes && data.routes.length > 0) {
            // --- DEĞİŞİKLİK BURADA: Sıkıştırılmış metni alıp çözüyoruz ---
            const encodedRoute = data.routes[0].geometry;
            const routeCoordinates = decodePolyline(encodedRoute); // Yeni fonksiyonumuzu kullanıyoruz

            const routeFeature = new ymaps3.YMapFeature({
                geometry: {
                    type: 'LineString',
                    coordinates: routeCoordinates // Artık Yandex'in anlayacağı formatta
                },
                style: {
                    stroke: [{ color: '#007BFF', width: 5 }]
                }
            });

            currentRoute = routeFeature;
            mapInstance.addChild(currentRoute);
        } else {
            throw new Error(data.error?.message || "Bu iki nokta arasında bir rota bulunamadı.");
        }

    } catch (error) {
        alert(`Rota çizilemedi: ${error.message}`);
    } finally {
        clickedButton.textContent = originalText;
        clickedButton.disabled = false;
    }
}

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
    document.getElementById('delivered-btn').addEventListener('click', (e) => handleStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));
    document.getElementById('not-home-btn').addEventListener('click', (e) => handleStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));
    document.getElementById('route-btn').addEventListener('click', (e) => drawRoute(gorev, e.target));
}

function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    if (currentRoute) {
        mapInstance.removeChild(currentRoute);
        currentRoute = null;
    }
    hidePanel();
}

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`)) return;
    const allButtons = clickedButton.parentElement.querySelectorAll('button');
    allButtons.forEach(btn => { btn.disabled = true; });
    clickedButton.textContent = 'İşleniyor...';
    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Görev durumu güncellenemedi. Lütfen tekrar deneyin.');
        allButtons.forEach(btn => { btn.disabled = false; });
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
