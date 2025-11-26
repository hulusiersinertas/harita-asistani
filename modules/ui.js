import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
import { initNavigation, getUserLocation, updateExternalCameraState, startNavigation, stopNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

// --- AYARLAR ---
const ZOOM_GENIS = 14;
const ZOOM_YAKIN = 16;

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
const navigationBtn = document.getElementById('navigation-toggle-btn');

// YENİ: Koordinatsız Butonları
const noCoordsBtn = document.getElementById('no-coords-btn');
const noCoordsBadge = document.getElementById('no-coords-badge');

// Uygulama Durumu (State)
let gorevlerData = [];
let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;

let isGuzergahActive = false;
let guzergahSiralamasi = [];

export function initUI(gorevler, map, placemarks, aracAdi, guzergahData) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;
    guzergahSiralamasi = guzergahData;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    
    // YENİ: Koordinatsızları kontrol et
    checkNoCoords(gorevler);

    // YENİ: Buton dinleyicisi
    if(noCoordsBtn) {
        noCoordsBtn.addEventListener('click', () => {
            const koordinatsizlar = gorevlerData.filter(g => !g.hasCoords);
            showListView(koordinatsizlar, "Koordinatsız İşler");
        });
    }

    initPanelManager({
        onGorevSelect: (gorevId) => {
            if (isGuzergahActive) return;
            focusOnGorev(gorevId);
        },
        onStatusUpdate: handleStatusUpdate, // Güncellenmiş hızlı fonksiyon
        onRouteClick: (gorev, button) => {
            if (isGuzergahActive) return;
            drawRouteToTask(gorev, button);
        },
        onDeselect: deselectGorev,
        onShowListView: () => displayListView(mahalleFiltresi.value)
    });
    
    initNavigation(map);
    initRouting(map);
    hidePanel();

    if (guzergahSiralamasi.length > 0) {
        guzergahBtn.style.display = 'flex';
    }
}

function setupEventListeners() {
    const { YMapListener } = ymaps3;

    const mapListener = new YMapListener({
        layer: 'any',
        onClick: (event) => {
            if (isGuzergahActive) return;
            
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                focusOnGorev(gorevId);
            } 
        },
        onUpdate: ({ camera }) => {
            updateExternalCameraState(camera);
        }
    });
    mapInstance.addChild(mapListener);

    mahalleFiltresi.addEventListener('change', () => {
        updateDropdownText(mahalleFiltresi.value);
        if (currentSelectedGorevId) deselectGorev();
        const selectedMahalle = mahalleFiltresi.value;
        displayListView(selectedMahalle);
        zoomToMahalle(selectedMahalle);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

// YENİ FONKSİYON: Koordinatı olmayanları say ve butonu göster
function checkNoCoords(gorevler) {
    if (!noCoordsBtn || !noCoordsBadge) return;
    const koordinatsizlar = gorevler.filter(g => !g.hasCoords);
    const sayi = koordinatsizlar.length;

    if (sayi > 0) {
        noCoordsBtn.style.display = 'flex';
        noCoordsBadge.textContent = sayi;
    } else {
        noCoordsBtn.style.display = 'none';
    }
}

// GÜNCELLENEN: Anında Tepki Veren Fonksiyon
async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} durumu "${newStatus}" olarak işaretlensin mi?`)) return;

    // 1. UI'dan hemen sil (Beklemek yok)
    removeGorev(gorevId);
    hidePanel();

    // 2. Arka planda sunucuya gönder
    updateGorevStatus(currentAracAdi, gorevId, newStatus)
        .then(success => {
            if (success) console.log(`${gorevId} sunucuya işlendi.`);
            else alert("Sunucu hatası! Sayfayı yenileyip kontrol edin.");
        })
        .catch(err => {
            console.error(err);
            alert("Bağlantı hatası! İşlem sunucuya gitmedi.");
        });
}

function zoomToMahalle(mahalleAdi) {
    let targets = [];
    if (mahalleAdi === 'TÜMÜ') {
        targets = gorevlerData.filter(g => g.hasCoords);
    } else {
        targets = gorevlerData.filter(g => g.mahalle === mahalleAdi && g.hasCoords);
    }

    if (targets.length === 0) return;

    let totalLat = 0, totalLon = 0;
    targets.forEach(t => {
        totalLat += t.enlem;
        totalLon += t.boylam;
    });
    
    const centerLat = totalLat / targets.length;
    const centerLon = totalLon / targets.length;

    mapInstance.update({
        location: {
            center: [centerLon, centerLat],
            zoom: ZOOM_GENIS,
            duration: 800
        }
    });
}

function focusOnGorev(gorevId) {
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev?.hasCoords) {
        if (mahalleFiltresi.value !== gorev.mahalle) {
            mahalleFiltresi.value = gorev.mahalle;
            updateDropdownText(gorev.mahalle);
        }
        mapInstance.update({ 
            location: { 
                center: [gorev.boylam, gorev.enlem], 
                zoom: 15,
                duration: 600 
            } 
        });
        selectGorev(gorevId);
    } else {
        alert('Koordinat yok.');
    }
}

function updateDropdownText(mahalleAdi) {
    if (!mahalleDisplayText) return;
    let text = mahalleAdi;
    if (mahalleAdi === 'TÜMÜ') text = "Tüm Mahalleler";
    const finalText = text.length > 18 ? text.substring(0, 16) + '...' : text;
    mahalleDisplayText.textContent = finalText;
}

function removeGorev(gorevId) {
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        mapInstance.removeChild(pin.marker);
        placemarksMap.delete(gorevId);
    }
    gorevlerData = gorevlerData.filter(g => g.id !== gorevId);
    kalanGorevSayaci.textContent = `Kalan: ${gorevlerData.length}`;
    
    // YENİ: Butonu güncelle
    checkNoCoords(gorevlerData);

    if (isGuzergahActive) {
        deselectGorev();
        findAndSelectNextGorev(); 
    } else {
        deselectGorev();
    }
}

function toggleGuzergahModu() {
    if (isGuzergahActive) stopGuzergah();
    else startGuzergah();
}

async function startGuzergah() {
    isGuzergahActive = true;
    guzergahBtn.innerHTML = '<span class="material-icons-outlined" style="color: #dc2626;">stop_circle</span>';
    mahalleFiltresi.disabled = true;
    navigationBtn.classList.remove('active');
    startNavigation();
    await findAndSelectNextGorev();
}

function stopGuzergah() {
    stopNavigation();
    isGuzergahActive = false;
    guzergahBtn.innerHTML = '<span class="material-icons-outlined">route</span>';
    mahalleFiltresi.disabled = false;
    deselectGorev();
    alert("Güzergah durduruldu.");
}

async function findAndSelectNextGorev() {
    try {
        const userLocation = await getUserLocation();
        const nextGorev = findNextGorev(userLocation, gorevlerData, guzergahSiralamasi);

        if (nextGorev) {
            stopNavigation();
            selectGorev(nextGorev.id);
            updateDropdownText(nextGorev.mahalle);
            mahalleFiltresi.value = nextGorev.mahalle;

            await drawRouteToTask(nextGorev, null);

            mapInstance.update({ 
                location: { 
                    center: [nextGorev.boylam, nextGorev.enlem], 
                    zoom: ZOOM_YAKIN,
                    duration: 800 
                } 
            });

            setTimeout(() => { startNavigation(); }, 2000);
        } else {
            alert("Güzergah tamamlandı!");
            stopGuzergah();
        }
    } catch (error) {
        console.error(error);
        stopGuzergah();
    }
}

function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
    updateDropdownText("TÜMÜ");
}

function selectGorev(gorevId) {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    }
    
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) return;

    pin.element.classList.add('selected');
    filterPinsOnMap(gorev.mahalle);
    showDetailView(gorev);
    adjustFabPosition(true); // Butonları yukarı kaldır
}

export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();
    filterPinsOnMap(mahalleFiltresi.value);
    hidePanel();
    adjustFabPosition(false); // Butonları aşağı indir
}

function displayListView(mahalleFilter = 'TÜMÜ') {
    filterPinsOnMap(mahalleFilter);
    const filtrelenmisGorevler = gorevlerData.filter(gorev => mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter);
    showListView(filtrelenmisGorevler);
}

function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (gorev) {
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.classList.toggle('filtered-out', !isMatch);
            pin.element.style.display = 'block'; 
        }
    });
}
// --- BUTON POZİSYONUNU AYARLAYAN FONKSİYON ---
function adjustFabPosition(isOpen) {
    const navBtn = document.getElementById('navigation-toggle-btn');
    const warnBtn = document.getElementById('no-coords-btn');

    // Panel açılınca 200px yukarı kaysınlar
    const transformValue = isOpen ? 'translateY(-200px)' : 'translateY(0)';

    // Navigasyon Butonunu Kaydır
    if (navBtn) {
        navBtn.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
        navBtn.style.transform = transformValue;
    }
    
    // Turuncu Butonu Kaydır
    if (warnBtn) {
        warnBtn.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
        warnBtn.style.transform = transformValue;
    }
}
