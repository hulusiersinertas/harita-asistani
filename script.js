// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js)
// == Sorumluluk: Tüm uygulama başlatma zincirini yönetir.
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    tumPlacemarks: []
};

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ (DOĞRU BEKLEME MANTIĞIYLA)
// =================================================================================

// 1. Tüm sayfa yüklendiğinde ana başlatıcıyı tetikle
document.addEventListener('DOMContentLoaded', () => {
    main();
});

// 2. Her şeyi doğru sırada başlatan ana async fonksiyon
async function main() {
    try {
        // A. Google API script'inin "gapi" nesnesini oluşturmasını bekle.
        await loadGoogleApiScript();
        console.log("Google API (gapi) script'i yüklendi.");
        
        // B. Google API istemcisini başlat.
        await gapi.client.init({
            'apiKey': AppConfig.GOOGLE_API_KEY,
            'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });
        console.log("Google API istemcisi hazır.");

        // C. Yandex API script'inin "ymaps3" nesnesini oluşturmasını bekle.
        // BU, "ymaps3 is not defined" HATASINI ÇÖZEN EN KRİTİK ADIMDIR.
        await ymaps3.ready;
        console.log("Yandex API (ymaps3) hazır.");

        // D. Artık her şey hazır olduğuna göre, uygulama mantığını başlatabiliriz.
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

// Google API script'inin yüklenmesini beklemek için bir yardımcı fonksiyon
function loadGoogleApiScript() {
    return new Promise((resolve) => {
        // gapi.load, Google'ın kendi içindeki asenkron yükleyiciyi kullanır.
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
