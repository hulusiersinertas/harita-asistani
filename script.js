// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js) - HATA AYIKLAMA VERSİYONU
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
        
        // --- HATA AYIKLAMA ADIMLARI ---
        // Promise.all'ı ayırarak hangi adımda takıldığını bulacağız.

        console.log("Adım 1: Google API istemcisi bekleniyor...");
        await API.initGoogleClient();
        console.log("✓ Adım 1 TAMAM: Google API istemcisi hazır.");

        console.log("Adım 2: Yandex API'sinin hazır olması bekleniyor...");
        await ymaps3.ready;
        console.log("✓ Adım 2 TAMAM: Yandex API hazır.");

        console.log("Tüm API'ler başarıyla yüklendi. Harita oluşturuluyor...");
        
        MapManager.initMap("map"); 

        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render();

    } catch (err) {
        console.error("Uygulama başlatılırken bir hata oluştu:", err);
        UI.showError(`Uygulama başlatılırken bir hata oluştu: ${err.message || err.details || 'Bilinmeyen Hata'}`);
    }
}
