// =================================================================================
// == ANA DOSYA: Orkestra Şefi (script.js) - NİHAİ VERSİYON
// =================================================================================

// Global Durum (State) Yönetimi
const AppState = { /* ... aynı kalır ... */ };
document.addEventListener('DOMContentLoaded', () => { UI.initEventListeners(); });

// =================================================================================
// == UYGULAMA BAŞLATMA ZİNCİRİ
// =================================================================================

// 1. Google API yüklendiğinde bu fonksiyon tetiklenir
function startApp() {
    gapi.load('client', initApplication);
}

// YENİ FONKSİYON: Yandex script'ini güvenli bir şekilde oluşturur ve yükler.
function loadYandexMapsAPI() {
    // Bu fonksiyon bir Promise döndürür, böylece yüklenmenin bitmesini bekleyebiliriz.
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Script'in tam ve doğru URL'ini en baştan oluşturuyoruz.
        script.src = `https://api-maps.yandex.ru/v3/?apikey=${AppConfig.YANDEX_API_KEY}&lang=tr_TR`;
        script.id = 'yandex-maps-script';
        
        // Script başarıyla yüklendiğinde Promise'i tamamla.
        script.onload = () => {
            console.log("Yandex API script'i başarıyla yüklendi.");
            resolve();
        };
        // Script yüklenirken hata olursa Promise'i reddet.
        script.onerror = () => {
            console.error("Yandex API script'i yüklenemedi.");
            reject(new Error("Yandex API script'i yüklenemedi."));
        };
        
        // Oluşturduğumuz script etiketini sayfanın <head> bölümüne ekle.
        document.head.appendChild(script);
    });
}

// 2. Tüm başlatma işlemlerini yöneten ana async fonksiyon
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
        
        // Adım 2.1: Google API ve Yandex API'nin yüklenmesini paralel olarak bekle.
        await Promise.all([
            API.initGoogleClient(),
            loadYandexMapsAPI() // Artık yeni, güvenli yükleyici fonksiyonumuzu çağırıyoruz.
        ]);

        // Adım 2.2: Yandex API'sinin iç kütüphanelerinin hazır olmasını bekle.
        await ymaps3.ready;
        console.log("Google ve Yandex API'leri tamamen hazır.");
        
        // Adım 2.3: Harita modülünü başlat.
        MapManager.initMap("map"); 

        // Adım 2.4: Google Sheets'ten ilk görev verisini çek.
        const gorevler = await API.fetchSheetData(AppState.aracSheetName);
        AppState.tumGorevler = gorevler;
        
        // Adım 2.5: Çekilen veriyle arayüzü doldur ve ilk render'ı yap.
        UI.mahalleFiltresiniDoldur(AppState.tumGorevler);
        UI.render();

    } catch (err) {
        console.error("Uygulama başlatılamadı:", err);
        UI.showError(`Uygulama başlatılırken bir hata oluştu: ${err.message || err.details || 'Bilinmeyen Hata'}`);
    }
}
