// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js) - NİHAİ BASİTLEŞTİRİLMİŞ VERSİYON
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    gorevMarkers: []
};

document.addEventListener('DOMContentLoaded', () => {
    UI.initEventListeners();
});

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ
// =================================================================================

// 1. Google API yüklendiğinde bu fonksiyon tetiklenir
function startApp() {
    gapi.load('client', initApplication);
}

// 2. Ana başlatma fonksiyonu
async function initApplication() {
    try {
        console.log("Uygulama başlatılıyor...");

        const params = new URLSearchParams(window.location.search);
        AppState.aracSheetName = params.get('arac');
        if (!AppState.aracSheetName) {
            UI.showError("URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)");
            return;
        }
        UI.setAracBaslik(`${AppState.aracSheetName} Görevleri`);
        
        // Adım 2.1: Google API ve Yandex API'nin hazır olmasını bekle.
        // Yandex script'i artık HTML tarafından yüklendiği için, sadece ymaps3.ready'i beklememiz yeterli.
        await Promise.all([
            API.initGoogleClient(),
            ymaps3.ready
        ]);
        console.log("Google ve Yandex API'leri tamamen hazır.");
        
        // Adım 2.2: Harita modülünü başlat.
        MapManager.initMap("map"); 

        // Adım 2.3: Google Sheets'ten ilk görev verisini çek.
        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        
        // Adım 2.4: Çekilen veriyle arayüzü doldur ve ilk render'ı yap.
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render();

    } catch (err) {
        console.error("Uygulama başlatılamadı:", err);
        UI.showError(`Uygulama başlatılırken bir hata oluştu: ${err.message || err.details || 'Bilinmeyen Hata'}`);
    }
}
