// ================================================================================
// DOSYA YOLU: modules/ui.js
// ================================================================================

import { updateGorevStatus } from './api.js';
import { initPanelManager, showDetailView, showListView, hidePanel } from './panelManager.js';
import { initNavigation, getUserLocation, updateExternalCameraState, startNavigation, stopNavigation } from './navigation.js';
import { initRouting, drawRouteToTask, clearCurrentRoute } from './route.js';
import { findNextGorev } from './guzergahManager.js';

// DOM Elementleri
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const mahalleDisplayText = document.getElementById('mahalle-display-text'); // Yeni eklenen görsel etiket
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

    // Panel yöneticisine (panelManager.js) callback fonksiyonlarını gönderiyoruz
    initPanelManager({
        onGorevSelect: (gorevId) => {
            if (isGuzergahActive) return;
            const gorev = gorevlerData.find(g => g.id === gorevId);
            if (gorev?.hasCoords) {
                mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 18, duration: 500 } });
                selectGorev(gorevId);
            } else { 
                alert('Bu görevin koordinat bilgisi bulunmuyor.'); 
            }
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

    // Eğer bu araç için tanımlı bir rota/güzergah sırası varsa butonu göster
    if (guzergahSiralamasi.length > 0) {
        guzergahBtn.style.display = 'flex'; // Flex yaptık çünkü artık ikonlu yuvarlak buton
    }
}

function setupEventListeners() {
    const { YMapListener } = ymaps3;

    // Harita üzerindeki tıklamaları dinle
    const mapListener = new YMapListener({
        layer: 'any',
        onPointerDown: (event) => {
            if (isGuzergahActive) return;
            // Tıklanan şey bir marker mı?
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                const gorev = gorevlerData.find(g => g.id === gorevId);
                
                if (gorev?.hasCoords) {
                    mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 18, duration: 500 } });
                }
                
                selectGorev(gorevId);
            }
        },
        onUpdate: ({ camera }) => {
            updateExternalCameraState(camera);
        }
    });
    mapInstance.addChild(mapListener);

    // Mahalle filtresi değiştiğinde (Görsel güncelleme mantığı eklendi)
    mahalleFiltresi.addEventListener('change', () => {
        // 1. Görsel etiketi güncelle
        const selectedText = mahalleFiltresi.options[mahalleFiltresi.selectedIndex].text;
        // Çok uzun isimleri kısalt (Tasarım bozulmasın diye)
        const displayText = selectedText.length > 15 ? selectedText.substring(0, 13) + '...' : selectedText;
        if (mahalleDisplayText) {
            mahalleDisplayText.textContent = displayText;
        }

        // 2. Seçili görev varsa iptal et
        if (currentSelectedGorevId) {
            deselectGorev();
        }

        // 3. Listeyi ve haritayı güncelle
        displayListView(mahalleFiltresi.value);
    });

    guzergahBtn.addEventListener('click', toggleGuzergahModu);
}

async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    if (!confirm(`${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`)) return;

    // Butonları geçici olarak devre dışı bırak
    const parentDiv = clickedButton.parentElement; // .action-grid
    if(parentDiv) {
        const allButtons = parentDiv.querySelectorAll('button');
        allButtons.forEach(btn => { btn.disabled = true; btn.style.opacity = '0.5'; });
    }
    
    // Butonun içeriğini değiştirerek feedback ver (ikonu spinner yapabiliriz ama basit tutalım)
    const originalContent = clickedButton.innerHTML;
    clickedButton.textContent = '...';

    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Görev durumu güncellenemedi. Lütfen tekrar deneyin.');
        // Hata olursa eski haline getir
        if(parentDiv) {
            const allButtons = parentDiv.querySelectorAll('button');
            allButtons.forEach(btn => { btn.disabled = false; btn.style.opacity = '1'; });
        }
        clickedButton.innerHTML = originalContent;
    }
}

function removeGorev(gorevId) {
    // Haritadan sil
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        mapInstance.removeChild(pin.marker);
        placemarksMap.delete(gorevId);
    }
    
    // Datadan sil
    gorevlerData = gorevlerData.filter(g => g.id !== gorevId);
    kalanGorevSayaci.textContent = `Kalan: ${gorevlerData.length}`;

    if (isGuzergahActive) {
        // Güzergah modundaysak paneli kapatıp hemen sonrakine geç
        deselectGorev();
        findAndSelectNextGorev(); 
    } else {
        // Normal moddaysak sadece paneli kapat
        deselectGorev();
        // Eğer liste açıkken işlem yapıldıysa listeyi güncelle
        if (document.getElementById('alt-panel').classList.contains('panel-open')) {
            displayListView(mahalleFiltresi.value);
        }
    }
}

function toggleGuzergahModu() {
    if (isGuzergahActive) {
        stopGuzergah();
    } else {
        startGuzergah();
    }
}

async function startGuzergah() {
    isGuzergahActive = true;
    // İkonu değiştir (Durdur ikonu)
    guzergahBtn.innerHTML = '<span class="material-icons-outlined" style="color: #dc2626;">stop_circle</span>';
    guzergahBtn.title = "Güzergahı Durdur";
    
    mahalleFiltresi.disabled = true;
    document.getElementById('gorunum-degistir-btn').disabled = true;
    
    // Diğer modları kapat
    navigationBtn.classList.remove('active'); // Varsa resetle

    startNavigation();
    await findAndSelectNextGorev();
}

function stopGuzergah() {
    stopNavigation();

    isGuzergahActive = false;
    // İkonu değiştir (Başlat ikonu)
    guzergahBtn.innerHTML = '<span class="material-icons-outlined">route</span>';
    guzergahBtn.title = "Güzergahı Başlat";
    
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
            // Navigasyon takibini geçici durdur (haritayı rahatça kaydırmak için)
            stopNavigation();
            
            selectGorev(nextGorev.id);
            await drawRouteToTask(nextGorev, null);

            await mapInstance.update({
                location: { center: [nextGorev.boylam, nextGorev.enlem], zoom: 18, duration: 800 }
            });

            // Kullanıcıya haritayı görmesi için 2 sn fırsat ver, sonra takibi tekrar aç
            setTimeout(() => {
                startNavigation();
            }, 2000);

        } else {
            alert("Tebrikler! Güzergahtaki tüm görevler tamamlandı.");
            stopGuzergah();
        }
    } catch (error) {
        alert(`Konum alınamadığı için güzergah devam edemiyor: ${error.message}`);
        stopGuzergah();
    }
}

function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
    
    // Görsel etiketi varsayılan yap
    if (mahalleDisplayText) {
        mahalleDisplayText.textContent = "Tüm Mahalleler";
    }
}

// export olmadığı için sadece bu dosya içinde kullanılabilir, bu doğru.
function selectGorev(gorevId) {
    // Önceki seçimi kaldır
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    }
    
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);

    if (!gorev || !pin) {
        return;
    }

    pin.element.classList.add('selected');
    showDetailView(gorev);

    // Eğer manuel moddaysak (güzergah değilse) filtreyi de güncellemek isteyebiliriz
    // Ancak yeni tasarımda filtreyi değiştirmek kafa karıştırıcı olabilir, 
    // şimdilik sadece pinleri filtrelemeden gösterelim veya olduğu gibi bırakalım.
}

// export edildi çünkü panelManager içindeki 'Kapat' butonu bunu çağırıyor
export function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    clearCurrentRoute();

    // Paneli kapat
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
            
            if (isVisible) {
                pin.element.classList.remove('filtered-out');
                pin.element.style.display = 'block'; // Görünür yap
            } else {
                pin.element.classList.add('filtered-out');
                pin.element.style.display = 'none'; // Tamamen gizle
            }
        }
    });
}
