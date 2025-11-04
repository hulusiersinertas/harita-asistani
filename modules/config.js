// =================================================================================
// == MODÜL: Yapılandırma (config.js)
// == Sorumluluk: Tüm API anahtarlarını, ID'leri ve ayarları tek bir yerde tutar.
// =================================================================================

const AppConfig = {
    GOOGLE_API_KEY: "AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY",
    SPREADSHEET_ID: "1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec",

    // E-Tablo Sütun İndeksleri (A=0, B=1, ...)
    // Bu yapı sayesinde gelecekte sütunların yeri değişirse, sadece burayı güncelleriz.
    SUTUNLAR: {
        AD_SOYAD: 4,  // E
        DURUM: 10,    // K
        TAM_ADRES: 11,// L
        ENLEM: 12,    // M
        BOYLAM: 13,   // N
        SONUC: 14     // O
    }
};