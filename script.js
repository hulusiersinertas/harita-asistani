// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
// Not: APPS_SCRIPT_URL şimdilik kullanılmıyor.
// =================================================================================

let myMap, aracSheetName, tumGorevler = [];

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
        tumGorevler = (response.result.values || []).map((row, index) => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            return {
                rowIndex: index + 4,
                adSoyad: row[4] || 'İsim Yok', durum: row[10] || '',
                tamAdres: row[11] || 'Adres Yok', 
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        
        renderUI();
    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function renderUI() {
    myMap.geoObjects.removeAll();
    const gorevListesiElementi = document.getElementById('gorev-listesi');
    gorevListesiElementi.innerHTML = '';
    
    const gecerliGorevler = tumGorevler.filter(g => g.enlem && g.boylam);
    document.getElementById('gorev-sayaci').textContent = `Kalan Görev: ${gecerliGorevler.length}`;

    if (gecerliGorevler.length === 0) {
        gorevListesiElementi.innerHTML = `<p style="text-align:center;">Gösterilecek görev bulunamadı.</p>`;
        return;
    }

    gecerliGorevler.forEach(gorev => {
        // 1. Harita Pinini Oluştur
        const placemark = new ymaps.Placemark(
            [gorev.enlem, gorev.boylam],
            { 
                // Metaveri: Pine tıklandığında hangi kartı vurgulayacağımızı bilmek için
                kartId: `gorev-${gorev.rowIndex}`
            },
            { preset: 'islands#blueCircleIcon' }
        );

        // Pine tıklama olayı
        placemark.events.add('click', (e) => {
            const kartId = e.get('target').properties.get('kartId');
            vurgulaVeKaydir(kartId);
        });
        
        myMap.geoObjects.add(placemark);

        // 2. Liste Kartını Oluştur
        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.id = `gorev-${gorev.rowIndex}`;
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
        
        // Karta tıklama olayı
        kart.onclick = () => {
            myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });
            vurgulaVeKaydir(kart.id);
        };

        gorevListesiElementi.appendChild(kart);
    });

    // Haritayı tüm pinlere odakla
    setTimeout(() => {
        if (myMap.geoObjects.getLength() > 0) {
            myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
        }
    }, 100);
}

function vurgulaVeKaydir(kartId) {
    // Önceki tüm vurguları kaldır
    document.querySelectorAll('.vurgulandi').forEach(el => el.classList.remove('vurgulandi'));
    
    const kartElement = document.getElementById(kartId);
    if (kartElement) {
        // Yeni kartı vurgula
        kartElement.classList.add('vurgulandi');
        // Karta doğru scroll yap
        kartElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Bir süre sonra vurguyu kaldır
        setTimeout(() => { kartElement.classList.remove('vurgulandi'); }, 2000);
    }
}
