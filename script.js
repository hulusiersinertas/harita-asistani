// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

// Global Değişkenler
let myMap, aracSheetName, tumGorevler = [], tumPlacemarks = [];

// Olay Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gorunum-degistir-btn').addEventListener('click', toggleGorunum);
    document.getElementById('mahalle-filtre').addEventListener('change', filtrele);
});

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ
// =================================================================================

function startApp() { gapi.load('client', initClient); }

function initClient() {
    gapi.client.init({
        'apiKey': GOOGLE_API_KEY,
        'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(() => { ymaps.ready(initMapAndData); }).catch(err => console.error("API istemcisi başlatılamadı:", err));
}

function initMapAndData() {
    const params = new URLSearchParams(window.location.search);
    aracSheetName = params.get('arac');
    if (!aracSheetName) { document.getElementById('arac-baslik').textContent = "HATA"; return; }
    document.getElementById('arac-baslik').textContent = `${aracSheetName} Görevleri`;
    myMap = new ymaps.Map("map", { center: [39.7667, 30.5256], zoom: 12 });
    fetchSheetData();
}

async function fetchSheetData() {
    const range = `'${aracSheetName}'!A4:P`;
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: range });
        tumGorevler = (response.result.values || []).map((row, index) => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            const tamAdres = row[11] || '';
            const mahalleMatch = tamAdres.match(/^.*?(MAH\.|MAHALLESİ)/i);
            return {
                rowIndex: index + 4, adSoyad: row[4] || 'İsim Yok', durum: row[10] || '', tamAdres: tamAdres, 
                mahalle: mahalleMatch ? mahalleMatch[0].trim().toUpperCase() : 'BİLİNMEYEN',
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
                gizli: false
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        
        mahalleFiltresiniDoldur();
        renderUI();
    } catch (error) { console.error("Veri çekme hatası:", error); }
}

// =================================================================================
// == ARAYÜZ OLUŞTURMA (RENDER) FONKSİYONLARI
// =================================================================================

function renderUI() {
    const bekleyenGorevler = tumGorevler.filter(g => !g.gizli);
    document.getElementById('gorev-sayaci').textContent = `Kalan: ${bekleyenGorevler.length}`;
    renderTamListe(bekleyenGorevler);
    renderHarita(bekleyenGorevler);
    renderDetayPaneli();
}

function mahalleFiltresiniDoldur() {
    const mahalleSelect = document.getElementById('mahalle-filtre');
    mahalleSelect.options.length = 1;
    const mahalleler = [...new Set(tumGorevler.map(g => g.mahalle))].sort();
    mahalleler.forEach(mahalle => {
        if (mahalle && mahalle !== 'BİLİNMEYEN') {
            const option = new Option(mahalle, mahalle);
            mahalleSelect.add(option);
        }
    });
}

function renderTamListe(gorevListesi) {
    const listeElementi = document.getElementById('gorev-listesi-tam');
    listeElementi.innerHTML = '';
    gorevListesi.forEach(gorev => {
        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.id = `liste-gorev-${gorev.rowIndex}`;
        kart.dataset.mahalle = gorev.mahalle;
        kart.onclick = () => listedenGorevSec(gorev.rowIndex);
        if (!gorev.enlem || !gorev.boylam) kart.classList.add('gorev-karti-hatali');
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
        listeElementi.appendChild(kart);
    });
}

function renderHarita(gorevListesi) {
    myMap.geoObjects.removeAll();
    tumPlacemarks = [];
    gorevListesi.forEach(gorev => {
        if (gorev.enlem && gorev.boylam) {
            const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], 
                { rowIndex: gorev.rowIndex, mahalle: gorev.mahalle }, 
                { preset: 'islands#blueDotIcon', openBalloonOnClick: false }
            );
            placemark.events.add('click', (e) => {
                const rowIndex = e.get('target').properties.get('rowIndex');
                renderDetayPaneli(rowIndex);
                vurgula(rowIndex);
            });
            tumPlacemarks.push(placemark);
        }
    });
    myMap.geoObjects.add(...tumPlacemarks);
    if (tumPlacemarks.length > 0) {
        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
}

function renderDetayPaneli(rowIndex) {
    const detayElementi = document.getElementById('gorev-detay');
    const gorev = tumGorevler.find(g => g.rowIndex === rowIndex);
    if (!gorev) { detayElementi.innerHTML = '<p style="color: #888;">Detayları görmek için bir nokta seçin.</p>'; return; }
    let navButon = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
    if (gorev.enlem && gorev.boylam) { navButon = `<a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>`; }
    detayElementi.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p><div class="buton-grup">${navButon}<button class="buton verildi-buton" onclick="updateGorev(${gorev.rowIndex}, 'Verildi', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Verildi</button><button class="buton evde-yok-buton" onclick="updateGorev(${gorev.rowIndex}, 'Evde Yok', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Evde Yok</button><button class="buton diger-buton" onclick="updateGorev(${gorev.rowIndex}, 'Adres Yanlış', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Adres Yanlış</button></div>`;
}

// =================================================================================
// == ETKİLEŞİM FONKSİYONLARI
// =================================================================================

function filtrele() {
    const secilenMahalle = document.getElementById('mahalle-filtre').value;
    const boundsToShow = [];
    tumPlacemarks.forEach(placemark => {
        const pinMahalle = placemark.properties.get('mahalle');
        if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
            placemark.options.set('preset', 'islands#blueDotIcon');
            placemark.options.set('opacity', 1);
            if (pinMahalle === secilenMahalle) boundsToShow.push(placemark.geometry.getCoordinates());
        } else {
            placemark.options.set('preset', 'islands#greyDotIcon');
            placemark.options.set('opacity', 0.5);
        }
    });
    document.querySelectorAll('#gorev-listesi-tam .gorev-karti').forEach(kart => {
        if (secilenMahalle === 'TUMU' || kart.dataset.mahalle === secilenMahalle) {
            kart.style.display = 'block';
        } else {
            kart.style.display = 'none';
        }
    });
    if (secilenMahalle === 'TUMU' && tumPlacemarks.length > 0) {
        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    } else if (boundsToShow.length > 0) {
        myMap.setBounds(ymaps.util.bounds.fromPoints(boundsToShow), { checkZoomRange: true, zoomMargin: 40 });
    }
}

async function updateGorev(rowIndex, sonuc, adSoyad) {
    if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return;
    const gorevIndex = tumGorevler.findIndex(g => g.rowIndex === rowIndex);
    if (gorevIndex > -1) { tumGorevler[gorevIndex].gizli = true; renderUI(); }
    const url = `${APPS_SCRIPT_URL}?sheet=${aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
    } catch (error) {
        alert('Sunucuya bağlanırken hata oluştu.');
        if (gorevIndex > -1) { tumGorevler[gorevIndex].gizli = false; renderUI(); }
    }
}

function toggleGorunum() {
    const body = document.body;
    const btn = document.getElementById('gorunum-degistir-btn');
    const mapElement = document.getElementById('map');
    function onTransitionEnd() { if (myMap) { myMap.container.fitToViewport(); } mapElement.removeEventListener('transitionend', onTransitionEnd); }
    mapElement.addEventListener('transitionend', onTransitionEnd);
    body.classList.toggle('liste-odakli');
    body.classList.toggle('harita-odakli');
    if (body.classList.contains('liste-odakli')) { btn.textContent = 'Haritayı Göster'; } else { btn.textContent = 'Listeyi Göster'; }
}

function listedenGorevSec(rowIndex) {
    const gorev = tumGorevler.find(g => g.rowIndex === rowIndex);
    if (gorev && gorev.enlem && gorev.boylam) { myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 }); }
    renderDetayPaneli(rowIndex);
    if (document.body.classList.contains('liste-odakli')) { toggleGorunum(); }
    vurgula(rowIndex);
}

function vurgula(rowIndex) {
    document.querySelectorAll('.vurgulandi').forEach(el => el.classList.remove('vurgulandi'));
    const kartElement = document.getElementById(`liste-gorev-${rowIndex}`);
    if (kartElement) { kartElement.classList.add('vurgulandi'); setTimeout(() => { kartElement.classList.remove('vurgulandi'); }, 1500); }
}
