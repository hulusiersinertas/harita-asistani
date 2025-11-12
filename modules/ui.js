import { updateGorevStatus } from './api.js';

// Global değişkenler
const altPanel = document.getElementById('alt-panel');
const mahalleFiltresi = document.getElementById('mahalle-filtresi');
const gorunumDegistirBtn = document.getElementById('gorunum-degistir-btn');
const kalanGorevSayaci = document.getElementById('kalan-gorev-sayaci');

let gorevlerData = [];
let placemarksMap = new Map();
let currentSelectedGorevId = null;
let mapInstance = null;
let currentAracAdi = '';

/**
 * UI'ı başlatır.
 */
export function initUI(gorevler, map, placemarks, aracAdi) {
    gorevlerData = gorevler;
    placemarksMap = placemarks;
    mapInstance = map;
    currentAracAdi = aracAdi;

    populateMahalleFiltresi(gorevler);
    setupEventListeners();
    hidePanel();
}

/**
 * Görevi uygulamadan (harita, liste, veri) kaldırır.
 */
function removeGorev(gorevId) {
    const pin = placemarksMap.get(gorevId);
    if (pin) {
        // YMapMarker'ı haritadan kaldırmak için parent'ından (map) removeChild kullanılır
        mapInstance.removeChild(pin.marker);
        placemarksMap.delete(gorevId);
    }
    gorevlerData = gorevlerData.filter(g => g.id !== gorevId);
    
    kalanGorevSayaci.textContent = `Kalan: ${gorevlerData.length}`;
    deselectGorev();
    
    if (altPanel.classList.contains('liste-acik')) {
        showListView(mahalleFiltresi.value);
    }
}

/**
 * Detay panelindeki eylem butonlarına basıldığında çalışır ve onay ister.
 */
async function handleStatusUpdate(newStatus, gorevId, adSoyad, clickedButton) {
    const confirmationMessage = `${adSoyad} için durumu "${newStatus}" olarak işaretlemek istediğinize emin misiniz?`;
    if (!confirm(confirmationMessage)) {
        return;
    }

    const originalText = clickedButton.textContent;
    const allButtons = clickedButton.parentElement.querySelectorAll('button');
    
    allButtons.forEach(btn => btn.disabled = true);
    clickedButton.textContent = 'İşleniyor...';

    const success = await updateGorevStatus(currentAracAdi, gorevId, newStatus);
    
    if (success) {
        removeGorev(gorevId);
    } else {
        alert('Görev durumu güncellenemedi. Lütfen tekrar deneyin.');
        allButtons.forEach(btn => btn.disabled = false);
        clickedButton.textContent = originalText;
    }
}

/**
 * Mahalle filtresini doldurur.
 */
function populateMahalleFiltresi(gorevler) {
    const mahalleler = new Set(gorevler.map(g => g.mahalle).filter(Boolean));
    const sortedMahalleler = [...mahalleler].sort((a, b) => a.localeCompare(b));
    mahalleFiltresi.innerHTML = '<option value="TÜMÜ">Tüm Mahalleler</option>';
    sortedMahalleler.forEach(mahalle => mahalleFiltresi.add(new Option(mahalle, mahalle)));
    mahalleFiltresi.disabled = false;
}

/**
 * Tüm olay dinleyicilerini ayarlar.
 */
function setupEventListeners() {
    const mapContainer = mapInstance.container;
    const mapListener = new ymaps3.YMapListener({
        layer: 'any',
        onMouseEnter: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'pointer'; },
        onMouseLeave: (obj) => { if (obj?.entity?.element?.classList.contains('placemark')) mapContainer.style.cursor = 'grab'; },
        onPointerDown: (event) => {
            if (event?.entity?.element?.classList.contains('placemark')) {
                const gorevId = parseInt(event.entity.element.dataset.id, 10);
                selectGorev(gorevId);
            }
        }
    });
    mapInstance.addChild(mapListener);
    mahalleFiltresi.addEventListener('change', () => showListView(mahalleFiltresi.value));
    gorunumDegistirBtn.addEventListener('click', () => altPanel.classList.contains('liste-acik') ? hidePanel() : showListView());
}

/**
 * Belirli bir görevi seçer ve detay görünümünü gösterir.
 */
function selectGorev(gorevId) {
    if (currentSelectedGorevId) placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
    currentSelectedGorevId = gorevId;
    const gorev = gorevlerData.find(g => g.id === gorevId);
    const pin = placemarksMap.get(gorevId);
    if (!gorev || !pin) return;
    pin.element.classList.add('selected');
    showDetailView(gorev);
}

/**
 * Alt paneli küçük (detay) modunda gösterir.
 */
function showDetailView(gorev) {
    altPanel.classList.remove('liste-acik');
    altPanel.innerHTML = `
        <div id="gorev-detay">
            <button class="close-panel-btn" id="close-btn" title="Paneli Kapat">&times;</button>
            <h3>${gorev.adSoyad} (${gorev.miktar} Adet)</h3>
            ${gorev.adresNotu ? `<p class="adres-notu">${gorev.adresNotu}</p>` : ''}
            <p>${gorev.tamAdres}</p>
            <div class="action-buttons">
                <button id="nav-btn">Navigasyon</button> 
                <button id="route-btn">Rota Çiz</button> 
                <button id="delivered-btn" class="status-btn">Verildi</button>
                <button id="not-home-btn" class="status-btn">Evde Yok</button> 
                ${gorev.telefon ? `<button id="call-btn">Ara</button>` : ''}
            </div>
        </div>
    `;
    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Listeyi Göster';

    document.getElementById('close-btn').addEventListener('click', deselectGorev);
    document.getElementById('nav-btn').addEventListener('click', () => window.open(`https://yandex.com.tr/maps/?rtext=~${gorev.enlem},${gorev.boylam}`, '_blank'));
    if (gorev.telefon) {
        document.getElementById('call-btn').addEventListener('click', () => window.location.href = `tel:${gorev.telefon}`);
    }
    
    const deliveredBtn = document.getElementById('delivered-btn');
    deliveredBtn.addEventListener('click', (e) => handleStatusUpdate('Verildi', gorev.id, gorev.adSoyad, e.target));

    const notHomeBtn = document.getElementById('not-home-btn');
    notHomeBtn.addEventListener('click', (e) => handleStatusUpdate('Evde Yok', gorev.id, gorev.adSoyad, e.target));

    document.getElementById('route-btn').addEventListener('click', () => alert('Rota Çizme özelliği yakında eklenecek.'));
}

/**
 * Tüm seçimleri temizler ve paneli gizler.
 */
function deselectGorev() {
    if (currentSelectedGorevId) {
        placemarksMap.get(currentSelectedGorevId)?.element.classList.remove('selected');
        currentSelectedGorevId = null;
    }
    hidePanel();
}

/**
 * Alt paneli tamamen gizler.
 */
function hidePanel() {
    altPanel.style.display = 'none';
    altPanel.classList.remove('liste-acik');
    gorunumDegistirBtn.textContent = 'Listeyi Göster';
}

/**
 * Alt paneli büyük (liste) modunda gösterir.
 */
function showListView(mahalleFilter = 'TÜMÜ') {
    altPanel.classList.add('liste-acik');
    filterPinsOnMap(mahalleFilter);
    const filtrelenmisGorevler = gorevlerData.filter(gorev => mahalleFilter === 'TÜMÜ' || gorev.mahalle === mahalleFilter);
    altPanel.innerHTML = `<div id="gorev-listesi">${filtrelenmisGorevler.map(gorev => `<div class="gorev-karti ${gorev.hasCoords ? '' : 'no-coords'}" data-id="${gorev.id}"><h4>${gorev.adSoyad} (${gorev.miktar} Adet)</h4><p>${gorev.tamAdres}</p>${gorev.adresNotu ? `<p><strong>Not:</strong> ${gorev.adresNotu}</p>` : ''}</div>`).join('')}</div>`;
    altPanel.querySelectorAll('.gorev-karti').forEach(kart => {
        kart.addEventListener('click', (e) => {
            const gorevId = parseInt(e.currentTarget.dataset.id, 10);
            const gorev = gorevlerData.find(g => g.id === gorevId);
            if (gorev?.hasCoords) {
                mapInstance.update({ location: { center: [gorev.boylam, gorev.enlem], zoom: 17, duration: 500 } });
                selectGorev(gorevId);
            } else {
                alert('Bu görevin koordinat bilgisi bulunmuyor.');
            }
        });
    });
    altPanel.style.display = 'block';
    gorunumDegistirBtn.textContent = 'Haritayı Göster';
}

/**
 * Haritadaki pinleri mahalleye göre filtreler.
 */
function filterPinsOnMap(secilenMahalle) {
    placemarksMap.forEach((pin, gorevId) => {
        const gorev = gorevlerData.find(g => g.id === gorevId);
        if (gorev) pin.element.classList.toggle('filtered-out', !(secilenMahalle === 'TÜMÜ' || gorev.mahalle === secilenMahalle));
    });
}
