// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

// Global değişkenler
let myMap;
let aracSheetName;
let gorevler = [];

function startApp() { gapi.load('client', initClient); }
function initClient() {
    gapi.client.init({
        'apiKey': GOOGLE_API_KEY,
        'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
    }).then(() => { ymaps.ready(initMapAndData); }).catch(err => { console.error("Google API istemcisi başlatılamadı:", err); document.getElementById('gorev-listesi').innerHTML = `<p style="color:red;">Hata: Google API istemcisi başlatılamadı.</p>`; });
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
    // Okuma aralığını geniş tutuyoruz, sorun olmaz.
    const range = `'${aracSheetName}'!A4:P`; 
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });
        
        const rows = response.result.values || [];
        
        console.log(`E-Tablodan ${rows.length} satır okundu.`);

        gorevler = rows
            .map((row, index) => {
                // =========================================================================
                // ==== SÜTUN İNDEKSİ HATASI DÜZELTİLDİ ====
                // =========================================================================
                // JavaScript'te diziler 0'dan başlar. A=0, B=1, ..., L=11, M=12, N=13
                const hamEnlem  = row[12]; // M sütunu (Enlem)
                const hamBoylam = row[13]; // N sütunu (Boylam)

                const enlemStr = String(hamEnlem || '').replace(/,/g, ''); 
                const boylamStr = String(hamBoylam || '').replace(/,/g, '');
                
                const enlem = enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null;
                const boylam = boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null;
                // =========================================================================

                if (index < 5) {
                    console.log(`Satır ${index + 4}: Ham Enlem='${hamEnlem}', İşlenmiş Enlem=${enlem} | Ham Boylam='${hamBoylam}', İşlenmiş Boylam=${boylam}`);
                }

                return {
                    rowIndex: index + 4,
                    adSoyad:  row[4]  || 'İsim Yok',      // E sütunu
                    durum:    row[10] || 'Bilinmiyor',    // K sütunu
                    tamAdres: row[11] || 'Adres Yok',     // L sütunu
                    enlem:    enlem,
                    boylam:   boylam,
                    sonuc:    row[14] || ''             // O sütunu
                };
            })
            .filter(g => {
                const gecerliMi = g.durum.toLowerCase().trim() === 'bekliyor' && g.enlem && g.boylam;
                if (!gecerliMi && g.durum.toLowerCase().trim() === 'bekliyor') {
                    console.warn(`Görev "${g.adSoyad}" filtrelendi çünkü koordinatları geçersiz: Enlem=${g.enlem}, Boylam=${g.boylam}`);
                }
                return gecerliMi;
            });
        
        console.log(`${gorevler.length} adet geçerli görev bulundu.`);

        renderUI();

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        document.getElementById('gorev-listesi').innerHTML = `<p style="color:red;">Veri çekilemedi. İzinleri kontrol edin.</p>`;
    }
}

// ... renderUI ve updateGorev fonksiyonları aynı kalıyor ...
function renderUI() {
    const gorevListesiElementi = document.getElementById('gorev-listesi');
    gorevListesiElementi.innerHTML = '';
    myMap.geoObjects.removeAll(); 

    document.getElementById('gorev-sayaci').textContent = `Kalan Görev: ${gorevler.length}`;

    if (gorevler.length === 0) {
        gorevListesiElementi.innerHTML = `<p style="color:green; font-weight:bold;">Tebrikler, bekleyen görev kalmadı!</p>`;
        return;
    }

    const geoObjects = []; 

    gorevler.forEach(gorev => {
        const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], { balloonContentHeader: `<b>${gorev.adSoyad}</b>`, balloonContentBody: gorev.tamAdres, iconCaption: gorev.adSoyad }, { preset: 'islands#blueDotIconWithCaption' });
        geoObjects.push(placemark);

        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.id = `gorev-${gorev.rowIndex}`;
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p><div class="buton-grup"><a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a><button class="buton verildi-buton" onclick="updateGorev(${gorev.rowIndex}, 'Verildi')">Verildi</button><button class="buton evde-yok-buton" onclick="updateGorev(${gorev.rowIndex}, 'Evde Yok')">Evde Yok</button><button class="buton diger-buton" onclick="updateGorev(${gorev.rowIndex}, 'Adres Yanlış')">Adres Yanlış</button></div>`;
        gorevListesiElementi.appendChild(kart);
    });
    
    const clusterer = new ymaps.Clusterer({ preset: 'islands#blueClusterIcons' });
    clusterer.add(geoObjects);
    myMap.geoObjects.add(clusterer);
    
    myMap.setBounds(clusterer.getBounds(), { checkZoomRange: true, zoomMargin: 35 });
}

async function updateGorev(rowIndex, sonuc) {
    // Bu versiyonda onay kutusu ve diğer özellikler yok, sadece temel güncelleme
    const gorevKarti = document.getElementById(`gorev-${rowIndex}`);
    gorevKarti.style.opacity = '0.5';
    const url = `${APPS_SCRIPT_URL}?sheet=${aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
    try {
        await fetch(url, { method: 'POST', mode: 'no-cors' });
        gorevKarti.classList.add('gizli');
        // Kalan görev sayısını anlık olarak güncelle
        const guncelGorevler = gorevler.filter(g => g.rowIndex !== rowIndex);
        gorevler = guncelGorevler;
        document.getElementById('gorev-sayaci').textContent = `Kalan Görev: ${gorevler.length}`;
    } catch(error) {
        alert('Sunucuya bağlanırken bir hata oluştu.');
        gorevKarti.style.opacity = '1';
    }
}
