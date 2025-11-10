// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js) - NİHAİ DÜZELTİLMİŞ VERSİYON
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

function startApp() {
    gapi.load('client', initApplication);
}

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
        
        await Promise.all([
            API.initGoogleClient(),
            ymaps3.ready
        ]);
        console.log("Google ve Yandex API'leri tamamen hazır.");
        
        // --- DEĞİŞİKLİK BURADA ---
        // initMap bir async fonksiyon olduğu için, onun tamamen bitmesini
        // ve AppState.myMap'i doldurmasını 'await' ile bekliyoruz.
        console.log("Harita başlatılıyor...");
        await MapManager.initMap("map"); 
        console.log("✓ Harita başarıyla başlatıldı.");

        console.log("Görev verileri çekiliyor...");
        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        console.log(`${gorevler.length} görev başarıyla çekildi.`);
        
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render();

    } catch (err) {
        console.error("Uygulama başlatılırken bir hata oluştu:", err);
        UI.showError(`Uygulama başlatılırken bir hata oluştu: ${err.message || err.details || 'Bilinmeyen Hata'}`);
    }
}
