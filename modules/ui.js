// DOSYA: modules/ui.js (GÜNCELLENMİŞ HALİ)

import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
import { initNavigation, getUserLocation, updateExternalCameraState, startNavigation, stopNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
const navigationBtn = document.getElementById('navigation-toggle-btn');

// State
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

    initPanelManager({
        onGorevSelect: (gorevId) => {
            if (isGuzergahActive) return;
            focusOnGorev(gorevId);
        },
        onStatusUpdate: handleStatusUpdate,
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

    // ÇÖZÜM 1: onPointerDown yerine onClick kullanarak sürükleme sırasındaki yanlış tıklamaları engelliyoruz.
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
        const selectedText = mahalleFiltresi.options[mahalleFiltresi.selectedIndex].text;
        const displayText = selectedText.length > 15 ? selectedText.substring(0, 13) + '...' : selectedText;
        if (mahalleDisplayText) mahalleDisplayText.textContent = displayText;

        if (currentSelectedGorevId) deselectGorev();

        const selectedMahalle = mahalleFiltresi.value;
        displayListView(selectedMahalle);
        
        // ÇÖZÜM 3: Mahalleye Zoom Yapma Mantığı
        zoomToMahalle(selectedMahalle);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

// ÇÖZÜM 2 ve 3: Zoom seviyesi ve Mahalle Odaklama Yardımcıları
function focusOnGorev(gorevId) {
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev?.hasCoords) {
        // ÇÖZÜM 2: Zoom seviyesini 18'den 16'ya düşürdük.
        mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 16, duration: 500 } });
        selectGorev(gorevId);
    } else {
        alert('Koordinat yok.');
    }
}

function zoomToMahalle(mahalle) {
    if (mahalle === 'TÜMÜ') return;

    // O mahalledeki koordinatlı görevleri bul
    const mahalleGorevleri = gorevlerData.filter(g => g.mahalle === mahalle && g.hasCoords);
    if (mahalleGorevleri.length === 0) return;

    // Sınırları (Bounds) Hesapla
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

    mahalleGorevleri.forEach(g => {
        if (g.enlem < minLat) minLat = g.enlem;
        if (g.enlem > maxLat) maxLat = g.enlem;
        if (g.boylam < minLon) minLon = g.boylam;
        if (g.boylam > maxLon) maxLon = g.boylam;
    });

    // Haritayı bu sınırlara oturt (biraz boşluk/padding bırakarak)
    // Yandex Maps v3'te bounds: [[minLon, minLat], [maxLon, maxLat]] formatındadır.
    mapInstance.update({
        location: {
            bounds: [[minLon, minLat], [maxLon, maxLat]],
            duration: 800
        }
    });
}

// ... (Geri kalan handleStatusUpdate, removeGorev, toggleGuzergahModu, startGuzergah, stopGuzergah, findAndSelectNextGorev aynı kalacak) ...
// ... Kod tekrarı olmasın diye buraya yazmıyorum, önceki ui.js'teki o fonksiyonları aynen koru ...

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`)) return;
    const parentDiv = clickedButton.parentElement;
    if(parentDiv) parentDiv.querySelectorAll('button').forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });
    const originalContent = clickedButton.innerHTML;
    clickedButton.textContent = '...';
    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Hata oluştu.');
        if(parentDiv) parentDiv.querySelectorAll('button').forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
        clickedButton.innerHTML = originalContent;
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
    if (isGuzergahActive) {
        deselectGorev();
        findAndSelectNextGorev(); 
    } else {
        deselectGorev();
        if (document.getElementById('alt-panel').classList.contains('panel-open')) {
            displayListView(mahalleFiltresi.value);
        }
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
    document.getElementById('gorunum-degistir-btn').disabled = true;
    navigationBtn.classList.remove('active');
    startNavigation();
    await findAndSelectNextGorev();
}

function stopGuzergah() {
    stopNavigation();
    isGuzergahActive = false;
    guzergahBtn.innerHTML = '<span class="material-icons-outlined">route</span>';
    mahalleFiltresi.disabled = false;
    document.getElementById('gorunum-degistir-btn').disabled = false;
    deselectGorev();
    alert("Güzergah modu durduruldu.");
}

async function findAndSelectNextGorev() {
    try {
        const userLocation = await getUserLocation();
        const nextGorev = findNextGorev(userLocation, gorevlerData, guzergahSiralamasi);
        if (nextGorev) {
            stopNavigation();
            selectGorev(nextGorev.id);
            await drawRouteToTask(nextGorev, null);
            mapInstance.update({ location: { center: [nextGorev.boylam, nextGorev.enlem], zoom: 16, duration: 800 } });
            setTimeout(() => { startNavigation(); }, 2000);
        } else {
            alert("Görev kalmadı.");
            stopGuzergah();
        }
    } catch (error) {
        alert(`Konum hatası: ${error.message}`);
        stopGuzergah();
    }
}

function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
    if (mahalleDisplayText) mahalleDisplayText.textContent = "Tüm Mahalleler";
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

export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();
    hidePanel();
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
            const isVisible = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.style.display = isVisible ? 'block' : 'none';
            pin.element.classList.toggle('filtered-out', !isVisible);
        }
    });
}
