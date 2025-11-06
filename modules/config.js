// =================================================================================
// == MODÜL: Yapılandırma (config.js)
// =================================================================================

const AppConfig = {
    // Kendi API anahtarlarınızı ve ID'lerinizi buraya yapıştırın
    GOOGLE_API_KEY: "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY",
    SPREADSHEET_ID: "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec",

    // E-Tablo Sütun İndeksleri (A=0, B=1, ...)
    SUTUNLAR: {
        AD_SOYAD: 4,      // E
        ADRES_NOTU: 5,    // F <-- YENİ EKLENDİ
        MIKTAR: 6,        // G <-- YENİ EKLENDİ
        TELEFON: 9,       // J
        DURUM: 10,        // K
        TAM_ADRES: 11,    // L
        ENLEM: 12,        // M
        BOYLAM: 13,       // N
        SONUC: 14         // O
    }
};
