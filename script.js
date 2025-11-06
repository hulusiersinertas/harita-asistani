// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js)
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    tumPlacemarks: []
};

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ (CALLBACK YÖNTEMİ)
// =================================================================================

// 1. BU FONKSİYON, SADECE YANDEX API HAZIR OLDUĞUNDA ÇAĞRILACAK.
// (index.html'deki onload="onYandexApiReady()" sayesinde)
async function onYandexApiReady() {
    console.log("Yandex API (ymaps3) hazır. Uygulama başlatılıyor...");

    try {
        // A. Yandex hazır olduğuna göre, şimdi Google'ı başlatalım.
        await loadGoogleApiScript();
        console.log("Google API (gapi) script'i yüklendi.");
        
        await gapi.client.init({
            'apiKey': AppConfig.GOOGLE_API_KEY,
            'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });
        console.log("Google API istemcisi hazır.");

        // B. Her şey hazır, ana uygulama mantığını çalıştır.
        const params = new URLSearchParams(window.location.search);
        AppState.aracSheetName = params.get('arac');

        if (!AppState.aracSheetName) {
            UI.showError("URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)");
            return;
        }

        UI.setAracBaslik(`${AppState.aracSheetName} Görevleri`);
        
        // Haritayı başlat
        await MapManager.initMap("map"); 

        // Veriyi çek
        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        
        // Arayüzü güncelle ve olay dinleyicilerini bağla
        UI.initEventListeners();
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render();

        console.log("Uygulama başarıyla başlatıldı!");

    } catch (err) {
        console.error("Uygulama başlatılamadı:", err);
        UI.showError("Kritik bir hata oluştu. Lütfen konsolu kontrol edin.");
    }
}

// Yandex API yüklenemezse bu fonksiyon çağrılır.
function onYandexApiError() {
    console.error("Yandex Maps API script'i yüklenemedi.");
    UI.showError("Harita yüklenemedi. Ağ bağlantınızı veya API anahtarınızı kontrol edin.");
}

// Google API script'inin yüklenmesini beklemek için bir yardımcı fonksiyon
function loadGoogleApiScript() {
    return new Promise((resolve) => {
        const checkGapi = () => {
            if (window.gapi && window.gapi.load) {
                gapi.load('client', resolve);
            } else {
                setTimeout(checkGapi, 100);
            }
        };
        checkGapi();
    });
}
