import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, showHistoryView, hidePanel } from './panelManager.js';
import { initNavigation, updateExternalCameraState, startNavigation, stopNavigation, getUserLocation } from './navigation.js';
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
const historyBtn = document.getElementById('history-btn');
const noCoordsBtn = document.getElementById('no-coords-btn');
const noCoordsBadge = document.getElementById('no-coords-badge');

// Uygulama Durumu (State)
let allTasks = [];       // Tüm veriler
let pendingTasks = [];   // Bekleyenler
let completedTasks = []; // Tamamlananlar

let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;

let isGuzergahActive = false;
let guzergahSiralamasi = [];

export function initUI(gorevler, map, placemarks, aracAdi, guzergahData) {
    allTasks = gorevler;
    mapInstance = map;
    placemarksMap = placemarks;
    currentAracAdi = aracAdi;
    guzergahSiralamasi = guzergahData;

    // Verileri ayır (Bekleyen / Biten)
    distributeTasks();

    // Filtreleri doldur
    populateMahalleFiltresi(pendingTasks);
    
    setupEventListeners();
    checkNoCoords(pendingTasks);

    if(noCoordsBtn) {
        noCoordsBtn.addEventListener('click', () => {
            const koordinatsizlar = pendingTasks.filter(g => !g.hasCoords);
            showListView(koordinatsizlar, "Koordinatsız İşler");
        });
    }

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
        onUndo: handleUndo
    });
    
    initNavigation(map);
    initRouting(map);
    hidePanel();

    if (guzergahSiralamasi.length > 0) {
        guzergahBtn.style.display = 'flex';
    }
}

function parseDateString(dateStr) {
    if (!dateStr) return 0;
    // Format: "14.12.2025 15:30:45"
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return 0;

    const [day, month, year] = datePart.split('.');
    const [hour, minute, second] = timePart.split(':');

    // Date objesi oluştur ve timestamp (sayı) döndür
    return new Date(year, month - 1, day, hour, minute, second).getTime();
}

function distributeTasks() {
    pendingTasks = allTasks.filter(t => t.durum === 'bekliyor');
    completedTasks = allTasks.filter(t => t.durum !== 'bekliyor');
    
    // YENİ SIRALAMA MANTIĞI:
    // Tamamlananları, "tamamlanmaZamani" verisine göre YENİDEN ESKİYE sırala
    completedTasks.sort((a, b) => {
        const timeA = parseDateString(a.tamamlanmaZamani);
        const timeB = parseDateString(b.tamamlanmaZamani);
        return timeB - timeA; // Büyük olan (yeni olan) başa gelir
    });

    if (kalanGorevSayaci) {
        kalanGorevSayaci.textContent = `Kalan: ${pendingTasks.length}`;
    }
}
function setupEventListeners() {
    const { YMapListener } = ymaps3;

    const mapListener = new YMapListener({
        layer: 'any',
        onClick: (event) => {
            if (isGuzergahActive) return;
            
            // Tıklanan elementin placemark olup olmadığını kontrol et
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
        displayListView(mahalleFiltresi.value);
        zoomToMahalle(mahalleFiltresi.value);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
    
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            // Tamamlananları göster
            showHistoryView(completedTasks);
        });
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

// --- EKSİK OLAN FONKSİYON BU ---
function updateDropdownText(mahalleAdi) {
    if (!mahalleDisplayText) return;
    let text = mahalleAdi;
    if (mahalleAdi === 'TÜMÜ') text = "Tüm Mahalleler";
    
    // Uzun isimleri kısalt
    const finalText = text.length > 18 ? text.substring(0, 16) + '...' : text;
    mahalleDisplayText.textContent = finalText;
}
// ------------------------------

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} durumu "${newStatus}" olarak işaretlensin mi?`)) return;

    // UI Güncelleme (Optimistic)
    const gorevIndex = allTasks.findIndex(g => g.id === gorevId);
    if (gorevIndex > -1) {
        allTasks[gorevIndex].durum = newStatus;
        
        // Marker'ı haritadan kaldır (ama Map nesnesinden silmiyoruz, referansı kalsın)
        const pin = placemarksMap.get(gorevId);
        if (pin) {
            // Sadece görsel olarak kaldırıyoruz, veriden silmiyoruz
            // Çünkü "Geri Al" yapılınca geri gelmesi lazım.
            // Yandex MapKit'te removeChild yeterli.
            mapInstance.removeChild(pin.marker);
        }
    }
    
    distributeTasks(); // Listeleri yenile
    checkNoCoords(pendingTasks);
    
    // Eğer o an seçili olan görevse paneli kapat
    if (currentSelectedGorevId === gorevId) {
        deselectGorev();
    } else {
        hidePanel();
    }

    // Güzergah modundaysak bir sonrakine geç
    if (isGuzergahActive) {
        findAndSelectNextGorev();
    }

    // Sunucuya Gönder
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

async function handleUndo(gorevId) {
    const gorev = allTasks.find(g => g.id === gorevId);
    if (!gorev) return;

    if (!confirm(`${gorev.adSoyad} tekrar "Bekliyor" listesine alınsın mı?`)) return;

    // UI Güncelleme
    gorev.durum = 'bekliyor';
    distributeTasks();
    checkNoCoords(pendingTasks);
    
    // Uygulamayı yenilemek en temiz yöntem (Markerları geri getirmek için)
    // Manuel marker eklemek karmaşık olabilir.
    alert("Görev geri alındı. Liste güncelleniyor...");
    
    await updateGorevStatus(currentAracAdi, gorevId, "Bekliyor");
    window.location.reload(); 
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

function removeGorev(gorevId) {
    // Bu fonksiyon artık handleStatusUpdate içinde yönetiliyor, 
    // ama eski referanslar için tutuyoruz, gerekirse kullanılabilir.
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        mapInstance.removeChild(pin.marker);
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
    
    // Butonları yukarı kaydır (CSS class veya style ile)
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
        // Sadece Bekleyenleri kontrol et
        const gorev = pendingTasks.find(g => g.id === gorevId);
        
        if (gorev) {
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.classList.toggle('filtered-out', !isMatch);
            // Eğer daha önce "none" yapılmışsa (tamamlandığı için), tekrar "block" yap
            pin.element.style.display = 'block'; 
        } else {
            // Görev pending listesinde yoksa (tamamlandıysa) gizle
            pin.element.style.display = 'none';
        }
    });
}
