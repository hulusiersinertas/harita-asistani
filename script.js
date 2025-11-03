// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

let myMap, aracSheetName, gorevler = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('gorunum-degistir-btn').addEventListener('click', toggleGorunum);
});

function startApp() { gapi.load('client', initClient); }

function initClient() {
    gapi.client.init({
        'apiKey': GOOGLE_API_KEY,
        'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(() => { ymaps.ready(initMapAndData); }).catch(err => { console.error("Google API istemcisi başlatılamadı:", err); });
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
        gorevler = (response.result.values || []).map((row, index) => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            return {
                rowIndex: index + 4, adSoyad: row[4] || 'İsim Yok', durum: row[10] || '',
                tamAdres: row[11] || 'Adres Yok', 
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
                gizli: false
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        renderUI();
    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function renderUI() {
    const bekleyenGorevler = gorevler.filter(g => !g.gizli);
    document.getElementById('gorev-sayaci').textContent = `Kalan: ${bekleyenGorevler.length}`;
    
    renderTamListe(bekleyenGorevler);
    renderHarita(bekleyenGorevler);
    renderDetayPaneli(); // Başlangıçta boş göster
}

function renderTamListe(gorevListesi) {
    const listeElementi = document.getElementById('gorev-listesi-tam');
    listeElementi.innerHTML = '';
    if (gorevListesi.length === 0) {
        listeElementi.innerHTML = `<p style="padding: 15px; text-align: center; color: green;">Tebrikler, görev kalmadı!</p>`;
        return;
    }
    gorevListesi.forEach(gorev => {
        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.onclick = () => listedenGorevSec(gorev.rowIndex);
        if (!gorev.enlem || !gorev.boylam) {
            kart.classList.add('gorev-karti-hatali');
        }
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
        listeElementi.appendChild(kart);
    });
}

function renderHarita(gorevListesi) {
    myMap.geoObjects.removeAll();
    const geoObjects = [];
    gorevListesi.forEach(gorev => {
        if (gorev.enlem && gorev.boylam) {
            const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], {
                rowIndex: gorev.rowIndex
            }, { preset: 'islands#blueDotIcon' });
            placemark.events.add('click', (e) => {
                const rowIndex = e.get('target').properties.get('rowIndex');
                renderDetayPaneli(rowIndex);
            });
            geoObjects.push(placemark);
        }
    });

    if (geoObjects.length > 0) {
        const clusterer = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
        clusterer.add(geoObjects);
        myMap.geoObjects.add(clusterer);
        myMap.setBounds(clusterer.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
}

function renderDetayPaneli(rowIndex) {
    const detayElementi = document.getElementById('gorev-detay');
    const gorev = gorevler.find(g => g.rowIndex === rowIndex);

    if (!gorev) {
        detayElementi.innerHTML = '<p style="color: #888;">Detayları görmek için haritadan bir nokta seçin.</p>';
        return;
    }
    
    let navButon = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
    if (gorev.enlem && gorev.boylam) {
        navButon = `<a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>`;
    }

    detayElementi.innerHTML = `
        <h3>${gorev.adSoyad}</h3>
        <p>${gorev.tamAdres}</p>
        <div class="buton-grup">
            ${navButon}
            <button class="buton verildi-buton" onclick="updateGorev(${gorev.rowIndex}, 'Verildi', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Verildi</button>
            <button class="buton evde-yok-buton" onclick="updateGorev(${gorev.rowIndex}, 'Evde Yok', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Evde Yok</button>
            <button class="buton diger-buton" onclick="updateGorev(${gorev.rowIndex}, 'Adres Yanlış', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Adres Yanlış</button>
        </div>
    `;
}

async function updateGorev(rowIndex, sonuc, adSoyad) {
    if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return;
    
    const gorevIndex = gorevler.findIndex(g => g.rowIndex === rowIndex);
    if (gorevIndex > -1) {
        gorevler[gorevIndex].gizli = true; 
        renderUI(); // Arayüzü anında yeniden çiz
    }
    
    const url = `${APPS_SCRIPT_URL}?sheet=${aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
    } catch(error) {
        alert('Sunucuya bağlanırken hata oluştu. Lütfen sayfayı yenileyin.');
        if (gorevIndex > -1) {
            gorevler[gorevIndex].gizli = false;
            renderUI();
        }
    }
}

function toggleGorunum() {
    const body = document.body;
    const btn = document.getElementById('gorunum-degistir-btn');
    body.classList.toggle('liste-odakli');
    body.classList.toggle('harita-odakli');
    if (body.classList.contains('liste-odakli')) {
        btn.textContent = 'Haritayı Göster';
    } else {
        btn.textContent = 'Listeyi Göster';
    }
    // Haritanın yeniden boyutlandırıldığını API'ye bildir
    myMap.container.fitToViewport();
}

function listedenGorevSec(rowIndex) {
    const gorev = gorevler.find(g => g.rowIndex === rowIndex);
    if (gorev && gorev.enlem && gorev.boylam) {
        myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });
    }
    renderDetayPaneli(rowIndex);
    // Liste görünümünden harita görünümüne geç
    if (document.body.classList.contains('liste-odakli')) {
        toggleGorunum();
    }
}
