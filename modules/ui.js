/* ================================================================================ */
/* DOSYA YOLU: modules/ui.js (BU KODUN TAMAMINI KOPYALAYIP MEVCUT DOSYAYLA DEĞİŞTİRİN) */
/* ================================================================================ */

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

// Navigasyon değişkenleri
let currentCameraState = { tilt: 0, azimuth: 0 };
let rotationDirection = 0;
const ROTATION_SPEED = 0.2;
let isNavigationModeActive = false;
let locationWatcherId = null;
let userMarker = null;

function decodePolyline(encoded) {
    let points = [], index = 0, len = encoded.length, lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;
        points.push([lng / 1e5, lat / 1e5]);
    }
    return points;
}

export function initUI(gorevler, map, placemarks, aracAdi) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;
    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    setupNavigationControls();
    hidePanel();
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve([position.coords.longitude, position.coords.latitude]),
            (error) => {
                let message = 'Konum bilgisi alınamadı.';
                if (error.code === error.PERMISSION_DENIED) message = 'Konum izni reddedildi.';
                reject(new Error(message));
            },
            { enableHighAccuracy: true }
        );
    });
}

function animateRotation() {
    if (rotationDirection === 0 || isNavigationModeActive) return;
    const newAzimuth = currentCameraState.azimuth + (rotationDirection * ROTATION_SPEED);
    mapInstance.update({ camera: { ...currentCameraState, azimuth: newAzimuth } });
    requestAnimationFrame(animateRotation);
}

function setupNavigationControls() {
    const { YMapMarker } = ymaps3;
    const rotateLeftBtn = document.getElementById('rotate-left');
    const rotateRightBtn = document.getElementById('rotate-right');
    const navigationBtn = document.getElementById('navigation-toggle-btn');

    const startNavigation = () => {
        if (!navigator.geolocation) { alert("Tarayıcınız konumu desteklemiyor."); return; }
        
        locationWatcherId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, heading } = position.coords;
                const userCoordinates = [longitude, latitude];

                if (!userMarker) {
                    const markerElement = document.createElement('div');
                    markerElement.className = 'user-marker';
                    userMarker = new YMapMarker({ coordinates: userCoordinates, zIndex: 10 }, markerElement);
                    mapInstance.addChild(userMarker);
                } else {
                    userMarker.update({ coordinates: userCoordinates });
                }
                
                if (heading !== null && heading >= 0) {
                    mapInstance.update({ camera: { ...currentCameraState, azimuth: heading } });
                }

                mapInstance.update({ location: { center: userCoordinates, zoom: 17, duration: 1000 } });
            },
            (error) => {
                console.error("Konum izleme hatası:", error);
                alert("Konum izlenirken bir hata oluştu. Mod durduruluyor.");
                stopNavigation();
            },
            { enableHighAccuracy: true }
        );
        
        isNavigationModeActive = true;
        navigationBtn.classList.add('active');
        navigationBtn.innerHTML = '🧭';

        if (currentSelectedGorevId) {
            const gorev = gorevlerData.find(g => g.id === currentSelectedGorevId);
            if (gorev) {
                drawRoute(gorev, null); 
            }
        }
    };

    const stopNavigation = () => {
        if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
        isNavigationModeActive = false;
        navigationBtn.classList.remove('active');
        navigationBtn.innerHTML = '🛰️';
    };
    
    const startRotation = (direction) => { if (isNavigationModeActive) return; if (rotationDirection === 0) { rotationDirection = direction; requestAnimationFrame(animateRotation); } else { rotationDirection = direction; } };
    const stopRotation = () => { rotationDirection = 0; };

    rotateLeftBtn.addEventListener('mousedown', () => startRotation(-1));
    rotateLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(-1); });
    rotateRightBtn.addEventListener('mousedown', () => startRotation(1));
    rotateRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(1); });
    document.addEventListener('mouseup', stopRotation);
    document.addEventListener('touchend', stopRotation);

    navigationBtn.addEventListener('click', () => { isNavigationModeActive ? stopNavigation() : startNavigation(); });
}

async function drawRoute(gorev, clickedButton) {
    let originalText = '';
    if (clickedButton) {
        originalText = clickedButton.textContent;
        clickedButton.textContent = 'Hesaplanıyor...';
        clickedButton.disabled = true;
    }

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
        
        if (data.routes && data.routes.length > 0) {
            const encodedRoute = data.routes[0].geometry;
            const routeCoordinates = decodePolyline(encodedRoute);

            const routeFeature = new ymaps3.YMapFeature({
                geometry: {
                    type: 'LineString',
                    coordinates: routeCoordinates
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
        if (clickedButton) {
            clickedButton.textContent = originalText;
            clickedButton.disabled = false;
        }
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
    const { YMapListener } = ymaps3;
    const mapContainer = mapInstance.container;
    const mapListener = new YMapListener({
        layer: 'any',
        onMouseEnter: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'pointer'; },
        onMouseLeave: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'grab'; },
        onPointerDown: (event) => {
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                selectGorev(gorevId);
            }
        },
        onUpdate: ({ camera }) => {
            currentCameraState = camera;
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
