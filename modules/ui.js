import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
import { initNavigation, getUserLocation, updateExternalCameraState, startNavigation, stopNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

// --- AYARLAR ---
const ZOOM_GENIS = 14;  // "Yüksekten" bakış (Mahalle veya Genel görünüm için)
const ZOOM_YAKIN = 16;  // Detay bakış (Navigasyon modu için)

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
const navigationBtn = document.getElementById('navigation-toggle-btn');

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

    // Mahalle Filtresi Değişimi
    mahalleFiltresi.addEventListener('change', () => {
        // 1. Yazıyı Güncelle
        updateDropdownText(mahalleFiltresi.value);

        // 2. Seçimi kaldır (Temiz sayfa)
        if (currentSelectedGorevId) deselectGorev();

        // 3. Listeyi güncelle
        const selectedMahalle = mahalleFiltresi.value;
        displayListView(selectedMahalle);

        // 4. SORUN 3 ve 4 ÇÖZÜMÜ: Haritayı o mahalleye uçur
        zoomToMahalle(selectedMahalle);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

// --- EKSİK OLAN FONKSİYON EKLENDİ ---
function zoomToMahalle(mahalleAdi) {
    let targets = [];

    if (mahalleAdi === 'TÜMÜ') {
        targets = gorevlerData.filter(g => g.hasCoords);
    } else {
        targets = gorevlerData.filter(g => g.mahalle === mahalleAdi && g.hasCoords);
    }

    if (targets.length === 0) return;

    // Ortalama koordinatı bul
    let totalLat = 0, totalLon = 0;
    targets.forEach(t => {
        totalLat += t.enlem;
        totalLon += t.boylam;
    });
    
    const centerLat = totalLat / targets.length;
    const centerLon = totalLon / targets.length;

    // Haritayı oraya kaydır (Wide Zoom / Geniş Açı ile)
    mapInstance.update({
        location: {
            center: [centerLon, centerLat],
            zoom: ZOOM_GENIS, // SORUN 4: Daha yüksekten bakış
            duration: 800 // Akıcı geçiş
        }
    });
}

function focusOnGorev(gorevId) {
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev?.hasCoords) {
        
        // SORUN 2 ÇÖZÜMÜ: Haritadan pini seçince Header'daki yazı da değişsin
        if (mahalleFiltresi.value !== gorev.mahalle) {
            mahalleFiltresi.value = gorev.mahalle; // Select'i güncelle
            updateDropdownText(gorev.mahalle);     // Görünür yazıyı güncelle
            // Not: filterPinsOnMap çağırmıyoruz ki diğer mahalleler kaybolmasın, 
            // sadece kullanıcı nerede olduğunu bilsin.
        }

        // Haritayı odakla (Biraz daha geniş açı ile - ZOOM_GENIS)
        // Kullanıcı "Yüksekten" istediği için ZOOM_GENIS (14) kullanıyoruz.
        // Tam dibine girmek isterse ZOOM_YAKIN (16) yapabilirsin.
        mapInstance.update({ 
            location: { 
                center: [gorev.boylam, gorev.enlem], 
                zoom: 15, // Tekil görev için orta karar bir zoom (14 çok uzak, 16 çok yakın)
                duration: 600 
            } 
        });
        selectGorev(gorevId);
    } else {
        alert('Koordinat yok.');
    }
}

// Helper: Dropdown yazısını güvenli güncelleme
function updateDropdownText(mahalleAdi) {
    if (!mahalleDisplayText) return;
    
    let text = mahalleAdi;
    if (mahalleAdi === 'TÜMÜ') text = "Tüm Mahalleler";
    
    // Uzun isimleri kısalt (CSS de yapıyor ama JS ile garantiye alalım)
    const finalText = text.length > 18 ? text.substring(0, 16) + '...' : text;
    mahalleDisplayText.textContent = finalText;
}

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} durumu "${newStatus}" olacak. Onaylıyor musunuz?`)) return;

    const parentDiv = clickedButton.parentElement;
    if(parentDiv) parentDiv.querySelectorAll('button').forEach(b => b.disabled = true);
    
    const originalContent = clickedButton.innerHTML;
    clickedButton.textContent = '...';

    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Güncelleme hatası.');
        if(parentDiv) parentDiv.querySelectorAll('button').forEach(b => b.disabled = false);
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
        displayListView(mahalleFiltresi.value);
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
            // Güzergahta da yazıyı güncelle
            updateDropdownText(nextGorev.mahalle);
            mahalleFiltresi.value = nextGorev.mahalle;

            await drawRouteToTask(nextGorev, null);

            mapInstance.update({ 
                location: { 
                    center: [nextGorev.boylam, nextGorev.enlem], 
                    zoom: ZOOM_YAKIN, // Güzergahta daha yakın olabilir
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
    
    // Sadece o mahallenin pinlerini vurgula (Kırmızı), diğerlerini soldur (Sarı)
    filterPinsOnMap(gorev.mahalle);

    showDetailView(gorev);
}

export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();

    // Seçim kalkınca harita renkleri, filtrede ne seçiliyse ona dönsün
    filterPinsOnMap(mahalleFiltresi.value);

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
            // Eğer dropdown'da TÜMÜ seçiliyse veya pin'in mahallesi seçiliyse aktif kalır.
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.classList.toggle('filtered-out', !isMatch);
            pin.element.style.display = 'block'; 
        }
    });
}