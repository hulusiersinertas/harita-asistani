import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
// GÜNCELLENDİ: startNavigation ve stopNavigation import edildi
import { initNavigation, getUserLocation, updateExternalCameraState, startNavigation, stopNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
// GÜNCELLENDİ: Navigasyon butonu elementi eklendi
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
 * Tüm UI modüllerini başlatır ve olay dinleyicilerini kurar.
 */
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
            const gorev = gorevlerData.find(g => g.id === gorevId);
            if (gorev?.hasCoords) {
                mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 17, duration: 500 } });
                selectGorev(gorevId);
            } else { alert('Bu görevin koordinat bilgisi bulunmuyor.'); }
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
        guzergahBtn.style.display = 'inline-block';
    }
}

// ... setupEventListeners, handleStatusUpdate, removeGorev fonksiyonları aynı kalıyor ...

function setupEventListeners() {
    const { YMapListener } = ymaps3;

    const mapListener = new YMapListener({
        layer: 'any',
        onPointerDown: (event) => {
            if (isGuzergahActive) return;
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                const gorev = gorevlerData.find(g => g.id === gorevId);
                
                if (gorev?.hasCoords) {
                    mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 17, duration: 500 } });
                }
                
                selectGorev(gorevId);
            }
        },
        onUpdate: ({ camera }) => {
            updateExternalCameraState(camera);
        }
    });
    mapInstance.addChild(mapListener);

    mahalleFiltresi.addEventListener('change', () => {
        if (currentSelectedGorevId) {
            deselectGorev();
        }
        displayListView(mahalleFiltresi.value);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`)) return;

    const allButtons = clickedButton.parentElement.querySelectorAll('button');
    allButtons.forEach(btn => { btn.disabled = true; });
    clickedButton.textContent = 'İşleniyor...';

    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    if (success) {
        await removeGorev(gorevId);
    } else {
        alert('Görev durumu güncellenemedi. Lütfen tekrar deneyin.');
        allButtons.forEach(btn => { btn.disabled = false; });
    }
}

async function removeGorev(gorevId) {
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        mapInstance.removeChild(pin.marker);
        placemarksMap.delete(gorevId);
    }
    gorevlerData = gorevlerData.filter(g => g.id !== gorevId);
    kalanGorevSayaci.textContent = `Kalan: ${gorevlerData.length}`;

    if (isGuzergahActive) {
        await findAndSelectNextGorev();
    } else {
        deselectGorev();
    }

    if (document.getElementById('alt-panel').classList.contains('liste-acik')) {
        displayListView(mahalleFiltresi.value);
    }
}

// ... toggleGuzergahModu fonksiyonu aynı kalıyor ...

function toggleGuzergahModu() {
    if (isGuzergahActive) {
        stopGuzergah();
    } else {
        startGuzergah();
    }
}

// GÜNCELLENDİ: Güzergah başlatma ve durdurma fonksiyonları
async function startGuzergah() {
    isGuzergahActive = true;
    guzergahBtn.textContent = 'Güzergahı Durdur';
    guzergahBtn.style.backgroundColor = '#dc3545';
    guzergahBtn.style.color = 'white';
    
    // Diğer kontrollleri devre dışı bırak
    mahalleFiltresi.disabled = true;
    document.getElementById('gorunum-degistir-btn').disabled = true;
    navigationBtn.disabled = true; // Pusula tuşu devre dışı

    startNavigation(); // Navigasyon modunu otomatik başlat
    await findAndSelectNextGorev();
}

function stopGuzergah() {
    stopNavigation(); // Navigasyon modunu durdur

    isGuzergahActive = false;
    guzergahBtn.textContent = 'Güzergahı Başlat';
    guzergahBtn.style.backgroundColor = '';
    guzergahBtn.style.color = '';
    
    // Kontrolleri tekrar aktif et
    mahalleFiltresi.disabled = false;
    document.getElementById('gorunum-degistir-btn').disabled = false;
    navigationBtn.disabled = false; // Pusula tuşu aktif

    deselectGorev();
    alert("Güzergah modu durduruldu.");
}

// GÜNCELLENDİ: Bir sonraki görevi bulma ve odaklanma mantığı
async function findAndSelectNextGorev() {
    try {
        const userLocation = await getUserLocation();
        const nextGorev = findNextGorev(userLocation, gorevlerData, guzergahSiralamasi);

        if (nextGorev) {
            stopNavigation(); // 1. Harita kontrolünü ele almak için GPS takibini anlık durdur
            
            selectGorev(nextGorev.id);
            await drawRouteToTask(nextGorev, null);

            // 2. Haritanın hedefe odaklanmasını bekle
            await mapInstance.update({
                location: { center: [nextGorev.boylam, nextGorev.enlem], zoom: 17, duration: 800 }
            });

            // 3. Kullanıcının hedefi görmesi için kısa bir süre bekle
            await new Promise(resolve => setTimeout(resolve, 2000));

            startNavigation(); // 4. GPS takibini yeniden başlat

        } else {
            alert("Tebrikler! Güzergahtaki tüm görevler tamamlandı.");
            stopGuzergah();
        }
    } catch (error) {
        alert(`Konum alınamadığı için güzergah başlatılamadı: ${error.message}`);
        stopGuzergah();
    }
}

// ... Diğer fonksiyonlar (populateMahalleFiltresi, selectGorev, deselectGorev, vb.) aynı kalıyor ...

function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
}

function selectGorev(gorevId) {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    }
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) {
        console.error(`Görev (ID: ${gorevId}) veya pini bulunamadı. Seçim yapılamıyor.`);
        return;
    }

    pin.element.classList.add('selected');
    showDetailView(gorev);

    if (!isGuzergahActive && gorev.mahalle) {
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

    if (mahalleFiltresi.value !== 'TÜMÜ') {
        mahalleFiltresi.value = 'TÜMÜ';
    }
    filterPinsOnMap('TÜMÜ');

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
            pin.element.classList.toggle('filtered-out', !isVisible);
        }
    });
}
