// =================================================================================
// == MODÜL: Yapılandırma (config.js)
// =================================================================================

const AppConfig = {
    // --- YANDEX API ANAHTARI ---
    // v3 projemizde kullanacağımız anahtar.
    YANDEX_API_KEY: "b0e9e934-4234-409b-9414-a486ede76f0c", // Lütfen kendi v3 anahtarınızla değiştirin

    // --- GOOGLE API AYARLARI ---
    GOOGLE_API_KEY: "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY",
    SPREADSHEET_ID: "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec",

    // --- E-TABLO SÜTUN İNDEKSLERİ ---
    // v3'e geçişte koordinat sırasının [boylam, enlem] olacağını unutmayın.
    // Şimdilik bu kısım aynı kalabilir, API modülünde bu dönüşümü yapacağız.
    SUTUNLAR: {
        AD_SOYAD: 4,      // E
        ADRES_NOTU: 5,    // F
        MIKTAR: 6,        // G
        TELEFON: 9,       // J
        DURUM: 10,        // K
        TAM_ADRES: 11,    // L
        ENLEM: 12,        // M
        BOYLAM: 13,       // N
        SONUC: 14         // O
    },
    
    // --- HARİTA AYARLARI ---
    // v3 haritası için başlangıç ayarları.
    MAP_DEFAULTS: {
        center: [30.5256, 39.7667], // v3 için [boylam, enlem] sırası
        zoom: 12
    }
};
