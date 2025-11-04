// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

let myMap, aracSheetName, tumGorevler = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mahalle-filtre').addEventListener('change', renderUI);
});

function startApp() { gapi.load('client', initClient); }

function initClient() {
    gapi.client.init({ 'apiKey': GOOGLE_API_KEY, 'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"] })
        .then(() => { ymaps.ready(initMapAndData); }).catch(err => console.error("API istemcisi başlatılamadı:", err));
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
        tumGorevler = (response.result.values || []).map(row => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            const tamAdres = row[11] || '';
            const mahalleMatch = tamAdres.match(/^.*?(MAH\.|MAHALLESİ)/i);
            return {
                rowIndex: row.length > 0 ? (response.result.values.indexOf(row) + 4) : null,
                adSoyad: row[4] || 'İsim Yok', durum: row[10] || '', tamAdres: tamAdres, 
                mahalle: mahalleMatch ? mahalleMatch[0].trim().toUpperCase() : 'BİLİNMEYEN',
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        
        mahalleFiltresiniDoldur();
        renderUI();
    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function mahalleFiltresiniDoldur() {
    const mahalleSelect = document.getElementById('mahalle-filtre');
    mahalleSelect.options.length = 1;
    const mahalleler = [...new Set(tumGorevler.map(g => g.mahalle))].sort();
    mahalleler.forEach(mahalle => {
        if (mahalle && mahalle !== 'BİLİNMEYEN') {
            mahalleSelect.add(new Option(mahalle, mahalle));
        }
    });
}

function renderUI() {
    const secilenMahalle = document.getElementById('mahalle-filtre').value;
    const gorevListesiElementi = document.getElementById('gorev-listesi');
    const geoObjects = [];

    gorevListesiElementi.innerHTML = '';
    myMap.geoObjects.removeAll();

    const gosterilecekGorevler = tumGorevler.filter(gorev => 
        (secilenMahalle === 'TUMU' || gorev.mahalle === secilenMahalle) && !gorev.gizli
    );

    document.getElementById('gorev-sayaci').textContent = `Gösterilen: ${gosterilecekGorevler.length}`;

    gosterilecekGorevler.forEach(gorev => {
        if (gorev.enlem && gorev.boylam) {
            const adSoyadEscaped = gorev.adSoyad.replace(/'/g, "\\'");
            const balloonLayoutString = `
                <div class="balloon-content">
                    <h4>${gorev.adSoyad}</h4>
                    <p>${gorev.tamAdres}</p>
                    <div class="buton-grup">
                        <button class="buton verildi-buton" onclick="window.updateGorev(${gorev.rowIndex}, 'Verildi', '${adSoyadEscaped}')">Verildi</button>
                        <button class="buton evde-yok-buton" onclick="window.updateGorev(${gorev.rowIndex}, 'Evde Yok', '${adSoyadEscaped}')">Evde Yok</button>
                    </div>
                    <div class="buton-grup" style="margin-top: 8px;">
                         <a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>
                         <button class="buton diger-buton" onclick="window.updateGorev(${gorev.rowIndex}, 'Adres Yanlış', '${adSoyadEscaped}')">Adres Y.</button>
                    </div>
                </div>
            `;
            const BalloonContentLayout = ymaps.templateLayoutFactory.createClass(balloonLayoutString);
            
            const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], 
                { iconCaption: gorev.adSoyad }, 
                { 
                    preset: 'islands#blueDotIconWithCaption',
                    balloonContentLayout: BalloonContentLayout,
                    balloonPanelMaxMapArea: 0
                }
            );
            geoObjects.push(placemark);
        }

        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
        gorevListesiElementi.appendChild(kart);
    });

    if (geoObjects.length > 0) {
        // ARTIK CLUSTERER KULLANMIYORUZ, DOĞRUDAN EKLİYORUZ
        myMap.geoObjects.add(...geoObjects);
        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    } else if (gosterilecekGorevler.length > 0) {
        myMap.setCenter([39.7667, 30.5256], 12);
    }
}

// Global scope'a taşınan fonksiyon (onclick'lerin çalışması için)
window.updateGorev = async function(rowIndex, sonuc, adSoyad) {
    if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return;
    
    if (myMap.balloon.isOpen()) {
        myMap.balloon.close();
    }

    // Görevi hafızadan "gizli" olarak işaretle ve arayüzü yeniden çiz
    const gorevIndex = tumGorevler.findIndex(g => g.rowIndex === rowIndex);
    if (gorevIndex > -1) {
        tumGorevler[gorevIndex].gizli = true; 
        renderUI();
    }
    
    // Arka planda Google'ı güncelle
    const url = `${APPS_SCRIPT_URL}?sheet=${aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
    } catch(error) {
        alert('Sunucuya bağlanırken bir hata oluştu. Lütfen sayfayı yenileyin.');
        // Hata durumunda, gizlenmiş görevi geri göster
        if (gorevIndex > -1) {
            tumGorevler[gorevIndex].gizli = false;
            renderUI();
        }
    }
};

