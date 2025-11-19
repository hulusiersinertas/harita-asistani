// ================================================================================
// DOSYA YOLU: modules/ui.js (FİNAL SÜRÜM)
// ================================================================================

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

// Uygulama Durumu (State)
let gorevlerData = [];
let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;

// Güzergah Modu Durumu
let isGuzergahActive = false;
let guzergahSiralamasi = [];

/**
 * Tüm UI modüllerini başlatır.
 */
export function initUI(gorevler, map, placemarks, aracAdi, guzergahData) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;
    guzergahSiralamasi = guzergahData;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();

    // Panel Yöneticisine Bağlan
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
        onDeselect: deselectGorev, // İşte bu eksik fonksiyon buraya bağlanıyor
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

    // Harita Tıklama Dinleyicisi (Sürükleme sorunu için onClick kullanıldı)
    const mapListener = new YMapListener({
        layer: 'any',
        onClick: (event) => {
            if (isGuzergahActive) return;
            
            // Tıklanan element bir placemark mı?
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                focusOnGorev(gorevId);
            } 
            // Boşluğa tıklanırsa seçimi kaldır
            else {
                // Harita etkileşimini bozmamak için burayı boş bırakabiliriz
                // veya deselectGorev() çağırabiliriz. Kullanım alışkanlığına bağlı.
            }
        },
        onUpdate: ({ camera }) => {
            updateExternalCameraState(camera);
        }
    });
    mapInstance.addChild(mapListener);

    // Mahalle Filtresi Değişimi
    mahalleFiltresi.addEventListener('change', () => {
        // Görsel yazıyı güncelle
        const selectedText = mahalleFiltresi.options[mahalleFiltresi.selectedIndex].text;
        const displayText = selectedText.length > 15 ? selectedText.substring(0, 13) + '...' : selectedText;
        if (mahalleDisplayText) mahalleDisplayText.textContent = displayText;

        // Varsa seçimi kaldır
        if (currentSelectedGorevId) {
            deselectGorev();
        }

        // Listeyi güncelle, haritayı boya ve zoom yap
        const selectedMahalle = mahalleFiltresi.value;
        displayListView(selectedMahalle);
        zoomToMahalle(selectedMahalle);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

// --- YARDIMCI FONKSİYONLAR ---

function focusOnGorev(gorevId) {
    const gorev = gorevlerData.find(g => g.id === gorevId);
    if (gorev?.hasCoords) {
        // DİNAMİK ZOOM AYARI:
        // Ekran genişliği 600px'den küçükse (Mobil) Zoom 15, değilse 16 olsun.
        const zoomLevel = window.innerWidth < 600 ? 15 : 16;

        mapInstance.update({ 
            location: { 
                center: [gorev.boylam, gorev.enlem], 
                zoom: zoomLevel, // 16 yerine hesapladığımız değeri kullanıyoruz
                duration: 500 
            } 
        });
        selectGorev(gorevId);
    } else {
        alert('Bu görevin koordinat bilgisi bulunmuyor.');
    }
}
async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`)) return;

    const parentDiv = clickedButton.parentElement;
    if(parentDiv) {
        const allButtons = parentDiv.querySelectorAll('button');
        allButtons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });
    }
    
    const originalContent = clickedButton.innerHTML;
    clickedButton.textContent = '...';

    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Hata oluştu.');
        if(parentDiv) {
            const allButtons = parentDiv.querySelectorAll('button');
            allButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
        }
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
    guzergahBtn.title = "Güzergahı Durdur";
    mahalleFiltresi.disabled = true;
    // Liste butonu kaldırıldığı için buradaki disable işlemini sildik
    navigationBtn.classList.remove('active');
    startNavigation();
    await findAndSelectNextGorev();
}

function stopGuzergah() {
    stopNavigation();
    isGuzergahActive = false;
    guzergahBtn.innerHTML = '<span class="material-icons-outlined">route</span>';
    guzergahBtn.title = "Güzergahı Başlat";
    mahalleFiltresi.disabled = false;
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

            // DİNAMİK ZOOM AYARI BURADA DA GEÇERLİ
            const zoomLevel = window.innerWidth < 600 ? 15 : 16;

            mapInstance.update({ 
                location: { 
                    center: [nextGorev.boylam, nextGorev.enlem], 
                    zoom: zoomLevel, // 16 yerine dinamik değer
                    duration: 800 
                } 
            });

            setTimeout(() => { startNavigation(); }, 2000);
        } else {
            alert("Tebrikler! Güzergahtaki tüm görevler tamamlandı.");
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
    
    if (mahalleDisplayText) {
        mahalleDisplayText.textContent = "Tüm Mahalleler";
    }
}

// --- PİN SEÇİM VE RENKLENDİRME MANTIĞI ---

function selectGorev(gorevId) {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    }
    
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) return;

    // 1. Seçili pini Mavi Yap
    pin.element.classList.add('selected');
    
    // 2. Sadece o mahallenin pinlerini Kırmızı, diğerlerini Sarı yap
    if (gorev.mahalle) {
        filterPinsOnMap(gorev.mahalle);
    }

    showDetailView(gorev);
}

// BURASI SENİN EKSİK OLAN FONKSİYONUN
export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();

    // Seçim kalkınca renkleri Dropdown'da ne seçiliyse ona döndür
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
            // Seçilen mahalledekilere (veya Tümü ise hepsine) dokunma (Kırmızı kalır)
            // Diğerlerine 'filtered-out' sınıfı ekle (Sarı olur)
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            
            pin.element.classList.toggle('filtered-out', !isMatch);
            
            // Hepsi görünür olsun, sadece renkleri değişsin
            pin.element.style.display = 'block'; 
        }
    });
}
