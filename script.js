// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
// =================================================================================

let myMap;
let aracSheetName;
let tumGorevler = [];

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
    
    console.log("Harita oluşturuluyor...");
    myMap = new ymaps.Map("map", { center: [39.7667, 30.5256], zoom: 12 });
    console.log("Harita oluşturuldu.");

    fetchSheetData();
}

async function fetchSheetData() {
    const range = `'${aracSheetName}'!A4:P`;
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: range });
        
        tumGorevler = (response.result.values || []).map(row => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            return {
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null
            };
        }).filter(g => g.enlem && g.boylam); // Sadece koordinatı olanları al
        
        console.log(`Veri çekildi ve işlendi. Haritaya çizilecek ${tumGorevler.length} nokta bulundu.`);

        // Veri çekildikten SONRA haritayı çiz.
        renderHarita();

    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function renderHarita() {
    console.log("--- renderHarita BAŞLADI ---");
    myMap.geoObjects.removeAll();

    if (tumGorevler.length === 0) {
        console.warn("Çizilecek nokta bulunamadı.");
        return;
    }

    // Yandex'in en aptal, en temel nokta ekleme yöntemini kullanıyoruz.
    // Her bir noktayı tek tek, doğrudan haritaya ekliyoruz.
    tumGorevler.forEach((gorev, index) => {
        console.log(`Pin ${index + 1} ekleniyor: [${gorev.enlem}, ${gorev.boylam}]`);
        myMap.geoObjects.add(new ymaps.Placemark([gorev.enlem, gorev.boylam]));
    });

    console.log(`${tumGorevler.length} adet pin haritaya eklendi.`);

    // Haritanın sınırlarını, haritaya eklenen nesnelere göre ayarla.
    setTimeout(() => {
        if (myMap.geoObjects.getLength() > 0) {
            myMap.setBounds(myMap.geoObjects.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 40
            });
            console.log("Harita sınırları ayarlandı.");
        } else {
            console.warn("Sınırlar ayarlanamadı çünkü haritada nesne yok.");
        }
    }, 500); // Haritanın çizim yapması için yarım saniye bekle
}
