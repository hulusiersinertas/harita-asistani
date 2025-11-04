// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
// =================================================================================

let myMap;
let aracSheetName;
let tumGorevler = [];

// Olay dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mahalle-filtre').addEventListener('change', renderUI); // Filtre değiştiğinde arayüzü yeniden çiz
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
                adSoyad: row[4] || 'İsim Yok', durum: row[10] || '', tamAdres: tamAdres, 
                mahalle: mahalleMatch ? mahalleMatch[0].trim().toUpperCase() : 'BİLİNMEYEN',
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        
        mahalleFiltresiniDoldur();
        renderUI(); // İlk çizimi yap
    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function mahalleFiltresiniDoldur() {
    const mahalleSelect = document.getElementById('mahalle-filtre');
    mahalleSelect.options.length = 1; // "Tüm Mahalleler" hariç temizle
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

    // Önceki çizimleri temizle
    gorevListesiElementi.innerHTML = '';
    myMap.geoObjects.removeAll();

    // Filtreleme yap
    const gosterilecekGorevler = tumGorevler.filter(gorev => 
        secilenMahalle === 'TUMU' || gorev.mahalle === secilenMahalle
    );

    document.getElementById('gorev-sayaci').textContent = `Gösterilen: ${gosterilecekGorevler.length}`;

    gosterilecekGorevler.forEach(gorev => {
        // Harita pinlerini oluştur
        if (gorev.enlem && gorev.boylam) {
            const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], { iconCaption: gorev.adSoyad }, { preset: 'islands#blueDotIcon' });
            geoObjects.push(placemark);
        }

        // Liste elemanlarını oluştur
        const kart = document.createElement('div');
        kart.className = 'gorev-karti';
        kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
        gorevListesiElementi.appendChild(kart);
    });

    // Pinleri haritaya ekle ve odaklan
    if (geoObjects.length > 0) {
        myMap.geoObjects.add(...geoObjects);
        myMap.setBounds(myMap.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    } else if (gosterilecekGorevler.length > 0) {
        // Haritada gösterilecek pin yok ama listede görev var (koordinatı olmayanlar)
        // Haritayı genel görünüme al
        myMap.setCenter([39.7667, 30.5256], 12);
    }
}
