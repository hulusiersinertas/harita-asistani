// =================================================================================
// == AYARLAR
// =================================================================================
const GOOGLE_API_KEY = "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY";
const SPREADSHEET_ID = "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec";
// =================================================================================

let myMap, aracSheetName, tumGorevler = [], tumPlacemarks = [];

document.addEventListener('DOMContentLoaded', () => { /* Butonlar şimdilik kapalı */ });
function startApp() { gapi.load('client', initClient); }
function initClient() { gapi.client.init({ 'apiKey': GOOGLE_API_KEY, 'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"] }).then(() => { ymaps.ready(initMapAndData); }).catch(err => console.error("API istemcisi başlatılamadı:", err)); }
function initMapAndData() { const params = new URLSearchParams(window.location.search); aracSheetName = params.get('arac'); if (!aracSheetName) { document.getElementById('arac-baslik').textContent = "HATA"; return; } document.getElementById('arac-baslik').textContent = `${aracSheetName} Görevleri`; myMap = new ymaps.Map("map", { center: [39.7667, 30.5256], zoom: 12 }); fetchSheetData(); }

async function fetchSheetData() {
    const range = `'${aracSheetName}'!A4:P`;
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: range });
        tumGorevler = (response.result.values || []).map((row, index) => {
            const hamEnlem = row[12], hamBoylam = row[13];
            const enlemStr = String(hamEnlem || '').replace(/,/g, ''), boylamStr = String(hamBoylam || '').replace(/,/g, '');
            return {
                rowIndex: index + 4, adSoyad: row[4] || 'İsim Yok', durum: row[10] || '', tamAdres: row[11] || '', 
                mahalle: "TEST", // Mahalle filtresini şimdilik devre dışı bırak
                enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
                gizli: false
            };
        }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        
        console.log(`[BİLGİ] Filtrelemeden sonra ${tumGorevler.length} görev bulundu.`);
        renderHarita(tumGorevler); // Listeyi doğrudan gönder

    } catch (error) { console.error("Veri çekme hatası:", error); }
}

function renderHarita(gorevListesi) {
    myMap.geoObjects.removeAll();
    const geoObjects = [];

    console.log(`--- renderHarita BAŞLADI ---`);
    console.log(`${gorevListesi.length} adet görev render edilecek.`);

    if (!gorevListesi || gorevListesi.length === 0) {
        console.error("renderHarita'ya boş görev listesi geldi. Fonksiyon durduruldu.");
        return;
    }

    try {
        gorevListesi.forEach((gorev, index) => {
            if (gorev.enlem && gorev.boylam) {
                // Her bir döngü adımını konsola yazdır
                console.log(`[Döngü ${index + 1}/${gorevListesi.length}] Pin oluşturuluyor: ${gorev.adSoyad}`);
                const placemark = new ymaps.Placemark(
                    [gorev.enlem, gorev.boylam],
                    { iconCaption: gorev.adSoyad },
                    { preset: 'islands#blueDotIcon' }
                );
                geoObjects.push(placemark);
            } else {
                console.warn(`[Döngü ${index + 1}] Görev atlandı (koordinat yok): ${gorev.adSoyad}`);
            }
        });

        console.log(`--- Döngü BİTTİ ---`);
        console.log(`${geoObjects.length} adet pin (placemark) başarıyla oluşturuldu.`);

        if (geoObjects.length > 0) {
            console.log("Pinler haritaya ekleniyor...");
            // Pinleri haritaya tek tek ekleyerek nerede hata olduğunu bulmaya çalışalım
            for(let i = 0; i < geoObjects.length; i++) {
                myMap.geoObjects.add(geoObjects[i]);
            }
            console.log(`${myMap.geoObjects.getLength()} adet pin haritaya eklendi.`);

            console.log("Harita sınırları ayarlanıyor...");
            myMap.setBounds(myMap.geoObjects.getBounds(), {
                checkZoomRange: true,
                zoomMargin: 40
            });
            console.log("Harita sınırları ayarlandı. İşlem tamam.");
        } else {
            console.error("Haritaya eklenecek hiç pin oluşturulamadı.");
        }
    } catch (error) {
        console.error("!!! renderHarita fonksiyonu içinde beklenmedik bir HATA oluştu !!!", error);
    }
}
