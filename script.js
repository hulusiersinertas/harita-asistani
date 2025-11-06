// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js)
// == Sorumluluk: Uygulama başlatma zincirini yönetir ve modüller arası iletişimi sağlar.
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    tumPlacemarks: [] // Bu, v3'te farklı yönetilecek.
};

// Olay Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    UI.initEventListeners();
});

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ (v3.0 İÇİN GÜNCELLENDİ)
// =================================================================================

// 1. Google API yüklendiğinde bu fonksiyon tetiklenir.
function startApp() {
    gapi.load('client', initApp); // Fonksiyon adını daha genel hale getirdik
}

// 2. async fonksiyon ile hem Google'ı hem Yandex'i başlatır.
async function initApp() {
    try {
        // Önce Google API istemcisini başlat ve bekle
        await API.initGoogleClient();
        console.log("Google API istemcisi hazır.");

        // Sonra Yandex Harita'yı başlat ve bekle
        await initMapAndData();
        console.log("Yandex Harita ve veriler hazır.");

    } catch (err) {
        console.error("Uygulama başlatılamadı:", err);
        UI.showError("Kritik bir hata oluştu. Lütfen konsolu kontrol edin.");
    }
}

// 3. Haritayı ve veriyi başlatan async fonksiyon
async function initMapAndData() {
    const params = new URLSearchParams(window.location.search);
    AppState.aracSheetName = params.get('arac');

    if (!AppState.aracSheetName) {
        UI.showError("URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)");
        return; // Hata durumunda fonksiyonu durdur
    }

    UI.setAracBaslik(`${AppState.aracSheetName} Görevleri`);
    
    // MapManager.initMap artık async olduğu için await ile bekliyoruz.
    await MapManager.initMap("map"); 

    // Veriyi çek
    const gorevler = await API.fetchSheetData(AppState.aracSheetName);
    AppState.tumGorevler = gorevler;
    
    // Veri çekildikten sonra arayüzü güncelle
    UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
    UI.render();
}
