// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

let myMap, aracSheetName, gorevler = [];

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
    if (!aracSheetName) { document.getElementById('arac-baslik').textContent = "HATA"; document.getElementById('gorev-listesi').innerHTML = `<p style="color:red;">URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)</p>`; return; }
    document.getElementById('arac-baslik').textContent = `${aracSheetName} Dağıtım Görevleri`;
    myMap = new ymaps.Map("map", { center: [39.7667, 30.5256], zoom: 12 });
    fetchSheetData();
}

async function fetchSheetData() {
    const range = `'${aracSheetName}'!A4:P`;
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: range });
        const rows = response.result.values || [];
        
        gorevler = rows.map((row, index) => {
            const hamEnlem = row[12]; // M sütunu
            const hamBoylam = row[13]; // N sütunu
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''); 
            const boylamStr = String(hamBoylam || '').replace(/,/g, '');
            const enlem = enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null;
            const boylam = boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null;

            return {
                rowIndex: index + 4, adSoyad: row[4] || 'İsim Yok', durum: row[10] || '',
                tamAdres: row[11] || 'Adres Yok', enlem: enlem, boylam: boylam, sonuc: row[14] || '', gizli: false
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor'); // SADECE DURUMU "BEKLİYOR" OLANLARI AL

        renderUI();
    } catch (error) {
        console.error("Veri çekme hatası:", error);
    }
}

function renderUI() {
    const gorevListesiElementi = document.getElementById('gorev-listesi');
    gorevListesiElementi.innerHTML = '';
    myMap.geoObjects.removeAll(); 

    const bekleyenGorevler = gorevler.filter(g => !g.gizli);
    document.getElementById('gorev-sayaci').textContent = `Kalan Görev: ${bekleyenGorevler.length}`;
    
    if (bekleyenGorevler.length === 0) {
        gorevListesiElementi.innerHTML = `<p style="color:green; font-weight:bold;">Tebrikler, bekleyen görev kalmadı!</p>`;
        myMap.setCenter([39.7667, 30.5256], 12);
        return;
    }

    const geoObjects = []; 
    bekleyenGorevler.forEach(gorev => {
        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.id = `gorev-${gorev.rowIndex}`;

        let navigasyonButonu = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
        
        // Geliştirme 1: Koordinatı olan ve olmayanları ayır
        if (gorev.enlem && gorev.boylam) {
            // Koordinatı VARSA: Pin oluştur ve navigasyon butonunu aktif et
            const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], {
                rowIndex: gorev.rowIndex,
                balloonContentHeader: `<b>${gorev.adSoyad}</b>`,
                balloonContentBody: gorev.tamAdres
            }, { preset: 'islands#blueDotIconWithCaption' });
            geoObjects.push(placemark);
            navigasyonButonu = `<a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>`;
        } else {
            // Koordinatı YOKSA: Kartı kırmızı ile vurgula
            kart.classList.add('gorev-karti-hatali');
        }

        // Geliştirme 2: Onay kutusu için 'adSoyad' bilgisini butona ekle
        kart.innerHTML = `
            <h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>
            <div class="buton-grup">
                ${navigasyonButonu}
                <button class="buton verildi-buton" onclick="updateGorev(${gorev.rowIndex}, 'Verildi', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Verildi</button>
                <button class="buton evde-yok-buton" onclick="updateGorev(${gorev.rowIndex}, 'Evde Yok', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Evde Yok</button>
                <button class="buton diger-buton" onclick="updateGorev(${gorev.rowIndex}, 'Adres Yanlış', '${gorev.adSoyad.replace(/'/g, "\\'")}')">Adres Yanlış</button>
            </div>`;
        gorevListesiElementi.appendChild(kart);
    });
    
    if (geoObjects.length > 0) {
        const clusterer = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
        clusterer.add(geoObjects);
        myMap.geoObjects.add(clusterer);
        
        myMap.setBounds(clusterer.getBounds(), {
            checkZoomRange: true,
            zoomMargin: 40
        });
    }
}

// Geliştirme 2: Onay kutusu eklendi
async function updateGorev(rowIndex, sonuc, adSoyad) {
    if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) {
        return; // Kullanıcı "İptal" derse işlemi durdur
    }
    
    const gorevKarti = document.getElementById(`gorev-${rowIndex}`);
    gorevKarti.style.opacity = '0.5';
    const url = `${APPS_SCRIPT_URL}?sheet=${aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
        
        // Anlık güncelleme için görevi "gizli" olarak işaretle ve arayüzü yeniden çiz
        const gorevIndex = gorevler.findIndex(g => g.rowIndex === rowIndex);
        if (gorevIndex > -1) {
            gorevler[gorevIndex].gizli = true; 
            renderUI(); // Haritayı ve listeyi anında güncelle
        }
        
    } catch(error) {
        alert('Sunucuya bağlanırken bir hata oluştu.');
        gorevKarti.style.opacity = '1';
    }
}
