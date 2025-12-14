import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, showHistoryView, hidePanel } from './panelManager.js'; // showHistoryView eklendi
import { initNavigation, updateExternalCameraState } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

const ZOOM_GENIS = 14;
const ZOOM_YAKIN = 16;

const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');
const guzergahBtn = document.getElementById('guzergah-toggle-btn');
const historyBtn = document.getElementById('history-btn'); // YENİ
const noCoordsBtn = document.getElementById('no-coords-btn');
const noCoordsBadge = document.getElementById('no-coords-badge');

// State
let allTasks = [];       // API'den gelen HAM veri (Hepsi)
let pendingTasks = [];   // Haritada görünenler (Bekleyen)
let completedTasks = []; // Geçmiş listesi

let placemarksMap = new Map();
let mapInstance = null;
let currentAracAdi = '';
let currentSelectedGorevId = null;

let isGuzergahActive = false;
let guzergahSiralamasi = [];

export function initUI(gorevler, map, placemarks, aracAdi, guzergahData) {
    allTasks = gorevler; // Hepsini sakla
    mapInstance = map;
    placemarksMap = placemarks; // DİKKAT: map.js zaten sadece koordinatı olanları ve bekleyenleri marker yaptı mı? 
                                // map.js güncellemedik, o yüzden oraya "bekleyen" filtresi koymak lazım. 
                                // Şimdilik buradaki veriyi yönetelim.
    currentAracAdi = aracAdi;
    guzergahSiralamasi = guzergahData;

    // Veriyi ayır
    distributeTasks();

    // Filtreleri sadece BEKLEYENLER üzerinden doldur
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
        
        // YENİ: Geri Alma (Undo) İşleyicisi
        onUndo: handleUndo
    });
    
    initNavigation(map);
    initRouting(map);
    hidePanel();

    if (guzergahSiralamasi.length > 0) {
        guzergahBtn.style.display = 'flex';
    }
}

// Veriyi duruma göre ayırma
function distributeTasks() {
    pendingTasks = allTasks.filter(t => t.durum === 'bekliyor');
    completedTasks = allTasks.filter(t => t.durum !== 'bekliyor');
    
    // Sayaç Güncelle
    kalanGorevSayaci.textContent = `Kalan: ${pendingTasks.length}`;
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
        displayListView(mahalleFiltresi.value);
        zoomToMahalle(mahalleFiltresi.value);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
    
    // YENİ: Geçmiş butonu
    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
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

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} durumu "${newStatus}" olarak işaretlensin mi?`)) return;

    // UI Güncelleme (Optimistic)
    const gorevIndex = allTasks.findIndex(g => g.id === gorevId);
    if (gorevIndex > -1) {
        allTasks[gorevIndex].durum = newStatus; // Durumu değiştir
        
        // Marker'ı kaldır
        const pin = placemarksMap.get(gorevId);
        if (pin) {
            mapInstance.removeChild(pin.marker);
            // Marker'ı silmiyoruz, haritadan kaldırıyoruz ama map'te kalsın, 
            // geri alınınca tekrar eklemek için referans lazım olabilir ama 
            // Yandex API'de marker'ı yeniden oluşturmak daha güvenli.
            placemarksMap.delete(gorevId);
        }
    }
    
    distributeTasks(); // Listeleri yenile
    checkNoCoords(pendingTasks); // Uyarıyı yenile
    hidePanel();

    // Sunucuya Gönder
    updateGorevStatus(currentAracAdi, gorevId, newStatus)
        .then(success => { if (!success) alert("Sunucu hatası!"); })
        .catch(err => alert("Bağlantı hatası!"));
}

// YENİ: Geri Alma Fonksiyonu
async function handleUndo(gorevId) {
    const gorev = allTasks.find(g => g.id === gorevId);
    if (!gorev) return;

    if (!confirm(`${gorev.adSoyad} tekrar "Bekliyor" listesine alınsın mı?`)) return;

    // UI Güncelleme
    gorev.durum = 'bekliyor';
    distributeTasks(); // Listeleri yenile
    checkNoCoords(pendingTasks);
    
    // Haritaya marker'ı geri ekle (Eğer koordinatı varsa)
    // NOT: map.js içinde exportlanmış bir 'addSingleMarker' fonksiyonu olsa iyi olurdu.
    // Şimdilik sayfayı yenilemek en temiz çözüm olabilir ama kullanıcı deneyimi için marker'ı manuel ekleyelim.
    // Ancak map.js'e erişimimiz kısıtlı.
    // En basiti:
    alert("Görev geri alındı. Haritada görünmesi için sayfa yenileniyor...");
    
    // Sunucuya "Bekliyor" gönder (Script bunu sıfırlama olarak algılayacak)
    await updateGorevStatus(currentAracAdi, gorevId, "Bekliyor");
    
    window.location.reload(); // Temiz bir başlangıç için reload
}

// ... (Diğer fonksiyonlar: zoomToMahalle, focusOnGorev vb. AYNI) ...
// (Buradan sonrasını kopyalamana gerek yok, mevcut dosyanın alt kısımları aynı kalıyor)
// Sadece populateMahalleFiltresi, deselectGorev vb. fonksiyonların `pendingTasks` kullandığından emin ol.

function populateMahalleFiltresi(gorevler) {
    // Sadece BEKLEYENLERİN mahallelerini göster
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
    updateDropdownText("TÜMÜ");
}

function displayListView(mahalleFilter = 'TÜMÜ') {
    filterPinsOnMap(mahalleFilter);
    // Sadece BEKLEYENLERİ listele
    const filtrelenmisGorevler = pendingTasks.filter(gorev => mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter);
    showListView(filtrelenmisGorevler);
}

function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        // Sadece BEKLEYENLERİ kontrol et
        const gorev = pendingTasks.find(g => g.id === gorevId);
        if (gorev) {
            const isMatch = (secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle);
            pin.element.classList.toggle('filtered-out', !isMatch);
            pin.element.style.display = 'block'; 
        } else {
            // Eğer tamamlandıysa haritada gösterme (Güvenlik önlemi)
            pin.element.style.display = 'none';
        }
    });
}
