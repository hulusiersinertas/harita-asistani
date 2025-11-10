// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js) - v3 UYUMLU
// == Sorumluluk: Uygulama başlatma zincirini yönetir ve modüller arası iletişimi sağlar.
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = {
    myMap: null,
    aracSheetName: null,
    tumGorevler: [],
    gorevMarkers: [] // v2'deki placemarks yerine v3'te marker'ları saklayacağız.
};

// Olay Dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    // Arayüz modülündeki olay dinleyicilerini başlat
    UI.initEventListeners();
});

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ
// =================================================================================

// 1. Google API yüklendiğinde bu fonksiyon tetiklenir (index.html'den)
function startApp() {
    // Google'ın GAPI kütüphanesini yükle ve ardından ana uygulama başlatıcısını çağır.
    gapi.load('client', initApplication);
}

// 2. Tüm başlatma işlemlerini yöneten ana async fonksiyon
async function initApplication() {
    try {
        console.log("Uygulama başlatılıyor...");

        // Adım 2.1: Yandex API script'ine API anahtarını dinamik olarak ekle.
        // Bu, anahtarın config dosyasında merkezi olarak yönetilmesini sağlar.
        const yandexScript = document.getElementById('yandex-maps-script');
        yandexScript.src += `&apikey=${AppConfig.YANDEX_API_KEY}`;
        console.log("Yandex API anahtarı eklendi.");

        // Adım 2.2: URL'den araç (sheet) adını al ve başlığı ayarla.
        const params = new URLSearchParams(window.location.search);
        AppState.aracSheetName = params.get('arac');

        if (!AppState.aracSheetName) {
            UI.showError("URL'de araç belirtilmemiş! (Örn: ?arac=OP-1)");
            return;
        }
        UI.setAracBaslik(`${AppState.aracSheetName} Görevleri`);
        
        // Adım 2.3: Google API ve Yandex API'nin yüklenmesini paralel olarak bekle.
        // Bu, uygulamanın daha hızlı açılmasına yardımcı olur.
        await Promise.all([
            API.initGoogleClient(), // Google Sheets API'sini hazırlar.
            ymaps3.ready            // Yandex Haritalar v3 API'sinin hazır olmasını bekler.
        ]);

        console.log("Google ve Yandex API'leri hazır.");

        // Adım 2.4: Harita modülünü başlat.
        // Bu fonksiyon artık v3'e göre yeniden yazılacak olan map.js içindedir.
        MapManager.initMap("map"); 

        // Adım 2.5: Google Sheets'ten ilk görev verisini çek.
        console.log("Görev verileri çekiliyor...");
        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        console.log(`${gorevler.length} görev başarıyla çekildi.`);

        // Adım 2.6: Çekilen veriyle arayüzü doldur ve ilk render'ı yap.
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render(); // Arayüz modülündeki ana çizim fonksiyonunu çağır

    } catch (err) {
        console.error("Uygulama başlatılamadı:", err);
        UI.showError(`Uygulama başlatılırken bir hata oluştu: ${err.message || err.details || 'Bilinmeyen Hata'}`);
    }
}