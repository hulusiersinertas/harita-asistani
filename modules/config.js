// Tüm API anahtarlarını, E-Tablo ID'sini ve diğer sabitleri burada saklıyoruz.
export const config = {
    // Google Sheets API'den veri OKUMAK için kullanılan anahtar.
    googleApiKey: 'AIzaSyBgtFHotp01PD_MHOTqfFmYHmP6Zb-mFsY',

    // Verilerin bulunduğu Google E-Tablosu'nun kimliği.
    spreadsheetId: '1OEfIZ4nuhG236chhiBibFUXMf2VR8ivBw_WXd4Zxkqc',

    // Google Apps Script'e veri YAZMAK için kullanılan URL.
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbwJ_i5tk-FInC2SxiE8opGY7ZbI9ffqyRPj5eJDnrxMrCdTKeJ2EffUzc5OS-GeeGZt/exec',

    // OpenRouteService API anahtarı.
    openRouteServiceApiKey: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImE5MTRjZTI4M2E1YTQzODdiZmFhYzFkMmEyNDVkYmRjIiwiaCI6Im11cm11cjY0In0=',

    // E-Tablo'daki sütunların kod içinde kullanılacak isimlerle eşleştirilmesi.
    // İndeksler 0'dan başlar (A=0, B=1, ... O=14, P=15).
    COLUMN_MAPPING: {
        AD_SOYAD: 4,     // E Sütunu
        ADRES_NOTU: 5,   // F Sütunu
        MIKTAR: 6,       // G Sütunu
        TELEFON: 9,      // J Sütunu
        DURUM: 10,       // K Sütunu
        TAM_ADRES: 11,   // L Sütunu
        ENLEM: 12,       // M Sütunu
        BOYLAM: 13,      // N Sütunu
        SONUC: 14,       // O Sütunu
        ZAMAN: 15,        // P Sütunu (YENİ EKLENDİ - İşlem Zamanı)
        NOT: 17          // R
    }
};

