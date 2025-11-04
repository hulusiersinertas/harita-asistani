// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js)
// == Sorumluluk: Uygulama başlatma zincirini yönetir ve modüller arası iletişimi sağlar.
// =================================================================================

// Global Durum (State) Yönetimi
// Uygulamanın o anki durumunu (harita nesnesi, görevler vb.) tutan merkezi nesne.
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    tumPlacemarks: []
};

// Olay Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    // Arayüz modülündeki olay dinleyicilerini başlat
    UI.initEventListeners();
});

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ
// =================================================================================

// 1. Google API yüklendiğinde bu fonksiyon tetiklenir.
function startApp() {
    gapi.load('client', initClient);
}

// 2. Google API istemcisini başlatır.
function initClient() {
    API.initGoogleClient()
        .then(() => {
            // Google hazır olduğunda, Yandex haritayı başlat.
            ymaps.ready(initMapAndData);
        })
        .catch(err => console.error("Google API istemcisi başlatılamadı:", err));
}

// 3. Yandex Harita'yı başlatır ve ilk veriyi çeker.
function initMapAndData() {
    const params = new URLSearchParams(window.location.search);
    AppState.aracSheetName = params.get('arac');

    if (!AppState.aracSheetName) {
        UI.showError("URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)");
        return;
    }

    UI.setAracBaslik(`${AppState.aracSheetName} Görevleri`);
    MapManager.initMap("map"); // Harita modülünü başlat

    // API modülü aracılığıyla ilk görev verisini çek.
    API.fetchSheetData(AppState.aracSheetName)
        .then(gorevler => {
            AppState.tumGorevler = gorevler;
            UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
            UI.render(); // Arayüz modülündeki ana çizim fonksiyonunu çağır
        })
        .catch(err => {
            console.error("Veri çekme hatası:", err);
            UI.showError("Veri çekilemedi. İzinleri veya Spreadsheet ID'yi kontrol edin.");
        });
}
