// DOSYA: modules/ui.js

import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, showHistoryView, hidePanel, showCustomRouteListView } from './panelManager.js';
import { initNavigation, updateExternalCameraState, startNavigation, stopNavigation, getUserLocation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';
import { addSingleMarker } from './map.js';
import * as CRM from './customRouteManager.js'; // Yeni Rota Yöneticisi

// Sabitler
const ZOOM_GENIS = 14;
const ZOOM_YAKIN = 16;

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
const historyBtn = document.getElementById('history-btn');
const noCoordsBtn = document.getElementById('no-coords-btn');
const noCoordsBadge = document.getElementById('no-coords-badge');
const customRouteListBtn = document.getElementById('custom-route-list-btn'); // Yeni Liste Butonu

// Veri State
let allTasks = [];
let pendingTasks = [];
let completedTasks = [];

let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;

let isGuzergahActive = false;
let guzergahSiralamasi = [];

/**
 * Uygulama Arayüzünü Başlatır
 */
export function initUI(gorevler, map, placemarks, aracAdi, guzergahData) {
    allTasks = gorevler;
    mapInstance = map;
    placemarksMap = placemarks;
    currentAracAdi = aracAdi;
    guzergahSiralamasi = guzergahData;

    distributeTasks();
    populateMahalleFiltresi(pendingTasks);
    setupEventListeners();
    checkNoCoords(pendingTasks);

    // Panel Yöneticisini Başlat ve Callbackleri Bağla
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
        onShowListView: () => displayListView(mahalleFiltresi.value),
        onUndo: handleUndo,
        
        // --- YENİ ROTA YÖNETİM CALLBACKLERİ ---
        onRouteAdd: (gorev) => {
            CRM.addToRoute(gorev, allTasks, currentAracAdi, () => {
                // Eklendikten sonra paneli güncelle
                showDetailView(gorev);
            });
        },
        onRouteRemove: (gorev) => {
            CRM.removeFromRoute(gorev, currentAracAdi, () => {
                showDetailView(gorev);
            });
        },
        onRouteMove: (gorev, direction) => {
            CRM.moveTask(gorev, direction, allTasks, currentAracAdi, () => {
                refreshActiveView(gorev);
            });
        },
        onManualSiraChange: (gorev, newVal) => {
            CRM.setManualSira(gorev, newVal, allTasks, currentAracAdi, () => {
                refreshActiveView(gorev);
            });
        }
    });
    
    initNavigation(map);
    initRouting(map);
    hidePanel();

    if (guzergahSiralamasi.length > 0) {
        guzergahBtn.style.display = 'flex';
    }
}

// --- YARDIMCI FONKSİYONLAR ---

// Hangi görünüm açıksa (Liste veya Detay) onu yeniler
function refreshActiveView(gorev) {
    const isListOpen = document.getElementById('custom-route-list-container');
    if(isListOpen) {
        openCustomRouteList();
    } else {
        showDetailView(gorev);
    }
}

// Yeni Özel Rota Listesini Aç
function openCustomRouteList() {
    // 9000'den küçük sırası olanları al (9999 varsayılan/boş kabul ediyoruz)
    const routeTasks = pendingTasks.filter(t => t.siraNo && t.siraNo < 9000);
    // Sıraya göre diz
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);
    
    showCustomRouteListView(routeTasks);
}

function distributeTasks() {
    pendingTasks = allTasks.filter(t => t.durum.toLowerCase() === 'bekliyor');
    completedTasks = allTasks.filter(t => t.durum.toLowerCase() !== 'bekliyor');
    
    // Varsayılan sıralama: Sira numarasına göre
    pendingTasks.sort((a, b) => a.siraNo - b.siraNo);

    // Tamamlananları tarihe göre sırala
    const parseDate = (str) => {
        if(!str) return 0;
        try {
            const [datePart, timePart] = str.split(' ');
            const [day, month, year] = datePart.split('.');
            const [hour, min, sec] = (timePart || "00:00:00").split(':');
            return new Date(year, month - 1, day, hour, min, sec || 0).getTime();
        } catch(e) { return 0; }
    };

    completedTasks.sort((a, b) => parseDate(b.tamamlanmaZamani) - parseDate(a.tamamlanmaZamani));
    
    if (kalanGorevSayaci) {
        kalanGorevSayaci.textContent = `Kalan: ${pendingTasks.length}`;
    }
}

function setupEventListeners() {
    const { YMapListener } = ymaps3;

    // Harita Tıklama
    const mapListener = new YMapListener({
        layer: 'any',
        onClick: (event) => {
            if (isGuzergahActive) return;
            // Placemark elementine tıklandığını yakala
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

    // Mahalle Filtresi
    mahalleFiltresi.addEventListener('change', () => {
        updateDropdownText(mahalleFiltresi.value);
        if (currentSelectedGorevId) deselectGorev();
        displayListView(mahalleFiltresi.value);
        zoomToMahalle(mahalleFiltresi.value);
    });

    // Otomatik Güzergah (Eski Özellik)
    guzergahBtn.addEventListener('click', toggleGuzergahModu);
    
    // Geçmiş
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            showHistoryView(completedTasks);
        });
    }

    // Koordinatsız Görevler Listesi
    if(noCoordsBtn) {
        noCoordsBtn.addEventListener('click', () => {
            const koordinatsizlar = pendingTasks.filter(g => !g.hasCoords);
            showListView(koordinatsizlar, "Koordinatsız İşler");
        });
    }

    // YENİ: Dağıtım Listem Butonu
    if(customRouteListBtn) {
        customRouteListBtn.addEventListener('click', openCustomRouteList);
    }
}

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

function updateDropdownText(mahalleAdi) {
    if (!mahalleDisplayText) return;
    let text = mahalleAdi;
    if (mahalleAdi === 'TÜMÜ') text = "Tüm Mahalleler";
    const finalText = text.length > 18 ? text.substring(0, 16) + '...' : text;
    mahalleDisplayText.textContent = finalText;
}

// --- GERİ ALMA (UNDO) ---
async function handleUndo(gorevId) {
    const gorevIndex = allTasks.findIndex(g => g.id === gorevId);
    if (gorevIndex === -1) return;

    const gorev = allTasks[gorevIndex];

    if (!confirm(`${gorev.adSoyad} tekrar "Bekliyor" listesine alınsın mı?`)) return;

    // Durum güncelle
    gorev.durum = 'bekliyor';
    gorev.not = "";
    gorev.tamamlanmaZamani = "";

    distributeTasks();

    checkNoCoords(pendingTasks);
    populateMahalleFiltresi(pendingTasks);

    // İğneyi geri ekle
    if (gorev.hasCoords) {
        const pinData = addSingleMarker(gorev);
        if (pinData) {
            placemarksMap.set(gorev.id, pinData);
            
            const currentFilter = mahalleFiltresi.value;
            const isMatch = (currentFilter === 'TÜMÜ' || gorev.mahalle === currentFilter);
            pinData.element.classList.toggle('filtered-out', !isMatch);
        }
    }

    // Paneli güncelle
    if (completedTasks.length > 0) {
        showHistoryView(completedTasks);
    } else {
        hidePanel();
    }

    // API
    updateGorevStatus(currentAracAdi, gorevId, "Bekliyor")
        .then(success => { if (!success) console.warn("Sunucu geri almayı kaydedemedi!"); })
        .catch(err => console.error("Bağlantı hatası:", err));
}

// --- DURUM GÜNCELLEME ---
async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton, note = "") {
    if (!confirm(`${adSoyad} durumu "${newStatus}" olarak işaretlensin mi?`)) return;

    const gorevIndex = allTasks.findIndex(g => g.id === gorevId);
    if (gorevIndex > -1) {
        allTasks[gorevIndex].durum = newStatus;
        if(note) allTasks[gorevIndex].not = note;
        
        const now = new Date();
        const formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth()+1).padStart(2, '0')}.${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        allTasks[gorevIndex].tamamlanmaZamani = formattedDate;

        const pin = placemarksMap.get(gorevId);
        if (pin) {
            mapInstance.removeChild(pin.marker);
            placemarksMap.delete(gorevId);
        }
    }
    
    distributeTasks(); 
    checkNoCoords(pendingTasks);
    
    // Paneli kapat veya sonrakine geç
    if (currentSelectedGorevId === gorevId) deselectGorev();
    else hidePanel();

    // Otomatik güzergah modundaysak sıradakine geç
    if (isGuzergahActive) findAndSelectNextGorev();

    // API isteği
    updateGorevStatus(currentAracAdi, gorevId, newStatus, note)
        .then(success => { if (!success) alert("Sunucu hatası!"); })
        .catch(err => alert("Bağlantı hatası!"));
}

function zoomToMahalle(mahalleAdi) {
    let targets = [];
    if (mahalleAdi === 'TÜMÜ') {
        targets = pendingTasks.filter(g => g.hasCoords);
    } else {
        targets = pendingTasks.filter(g => g.mahalle === mahalleAdi && g.hasCoords);
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
    const gorev = allTasks.find(g => g.id === gorevId);
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

// --- OTOMATİK GÜZERGAH (ESKİ) ---
function toggleGuzergahModu() {
    if (isGuzergahActive) stopGuzergah();
    else startGuzergah();
}

async function startGuzergah() {
    isGuzergahActive = true;
    guzergahBtn.innerHTML = '<span class="material-icons-outlined" style="color: #dc2626;">stop_circle</span>';
    mahalleFiltresi.disabled = true;
    const navBtn = document.getElementById('navigation-toggle-btn');
    if(navBtn) navBtn.classList.remove('active');
    
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
        const nextGorev = findNextGorev(userLocation, pendingTasks, guzergahSiralamasi);

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
    const gorev = allTasks.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) return;

    pin.element.classList.add('selected');
    filterPinsOnMap(gorev.mahalle);
    showDetailView(gorev);
    
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(true);
    }
}

export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();
    filterPinsOnMap(mahalleFiltresi.value);
    hidePanel();
    
    if (typeof window.adjustFabPosition === 'function') {
        window.adjustFabPosition(false);
    }
}

function displayListView(mahalleFilter = 'TÜMÜ') {
    filterPinsOnMap(mahalleFilter);
    const filtrelenmisGorevler = pendingTasks.filter(gorev => mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter);
    showListView(filtrelenmisGorevler);
}

function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = pendingTasks.find(g => g.id === gorevId);
        
        if (gorev) {
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.classList.toggle('filtered-out', !isMatch);
            pin.element.style.display = 'block'; 
        } else {
            pin.element.style.display = 'none';
        }
    });
}
