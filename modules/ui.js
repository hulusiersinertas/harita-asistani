/*
 * Bu dosya artık bir "Orkestra Şefi" görevi görüyor.
 * Diğer modülleri (panelManager, navigation, route) başlatır ve aralarındaki iletişimi sağlar.
 * Ana olay dinleyicileri (harita tıklaması, filtreleme) burada yönetilir.
 */

import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
import { initNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');

// Uygulama Durumu (State)
let gorevlerData = [];
let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;
let currentCameraState = { tilt: 0, azimuth: 0 };

/**
 * Tüm UI modüllerini başlatır ve olay dinleyicilerini kurar.
 */
export function initUI(gorevler, map, placemarks, aracAdi) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();

    // Uzman modülleri harita nesnesi ve callback'lerle başlat
    initPanelManager({
        onGorevSelect: (gorevId) => {
            const gorev = gorevlerData.find(g => g.id === gorevId);
            if (gorev?.hasCoords) {
                mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 17, duration: 500 } });
                selectGorev(gorevId);
            } else {
                alert('Bu görevin koordinat bilgisi bulunmuyor.');
            }
        },
        onStatusUpdate: handleStatusUpdate,
        onRouteClick: drawRouteToTask,
        onDeselect: deselectGorev,
        onShowListView: () => displayListView(mahalleFiltresi.value)
    });
    initNavigation(map, (newCamera) => { currentCameraState = newCamera; });
    initRouting(map);

    hidePanel();
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

    mahalleFiltresi.addEventListener('change', () => displayListView(mahalleFiltresi.value));
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
    showDetailView(gorev);

    if (gorev.mahalle) {
        mahalleFiltresi.value = gorev.mahalle;
        filterPinsOnMap(gorev.mahalle);
    }
}

function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();
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

    if (document.getElementById('alt-panel').classList.contains('liste-acik')) {
        displayListView(mahalleFiltresi.value);
    }
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
            pin.element.classList.toggle('filtered-out', !isVisible);
        }
    });
}
