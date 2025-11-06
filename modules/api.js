// =================================================================================
// == MODÜL: API İşlemleri (api.js)
// =================================================================================

const API = {
    initGoogleClient: function() {
        return gapi.client.init({
            'apiKey': AppConfig.GOOGLE_API_KEY,
            'discoveryDocs': ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });
    },

    fetchSheetData: async function(sheetName) {
        const range = `'${sheetName}'!A4:P`;
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: AppConfig.SPREADSHEET_ID,
                range: range
            });

            return (response.result.values || []).map((row, index) => {
                const hamEnlem = row[AppConfig.SUTUNLAR.ENLEM];
                const hamBoylam = row[AppConfig.SUTUNLAR.BOYLAM];
                const enlemStr = String(hamEnlem || '').replace(/,/g, '');
                const boylamStr = String(hamBoylam || '').replace(/,/g, '');
                const tamAdres = row[AppConfig.SUTUNLAR.TAM_ADRES] || '';
                const mahalleMatch = tamAdres.match(/^.*?(MAH\.|MAHALLESİ)/i);

                return {
                    rowIndex: index + 4,
                    adSoyad: row[AppConfig.SUTUNLAR.AD_SOYAD] || 'İsim Yok',
                    adresNotu: row[AppConfig.SUTUNLAR.ADRES_NOTU] || '', // <-- YENİ EKLENDİ
                    miktar: row[AppConfig.SUTUNLAR.MIKTAR] || '',       // <-- YENİ EKLENDİ
                    durum: row[AppConfig.SUTUNLAR.DURUM] || '',
                    tamAdres: tamAdres,
                    mahalle: mahalleMatch ? mahalleMatch[0].trim().toUpperCase() : 'BİLİNMEYEN',
                    telefon: row[AppConfig.SUTUNLAR.TELEFON] || '',
                    enlem: enlemStr.length > 2 ? parseFloat(enlemStr.slice(0, 2) + '.' + enlemStr.slice(2)) : null,
                    boylam: boylamStr.length > 2 ? parseFloat(boylamStr.slice(0, 2) + '.' + boylamStr.slice(2)) : null,
                    gizli: false
                };
            }).filter(g => g.durum.trim().toLowerCase() === 'bekliyor');
        } catch (error) {
            console.error("API.fetchSheetData hatası:", error);
            throw error;
        }
    },

    updateGorevStatus: async function(rowIndex, sonuc) {
        const url = `${AppConfig.APPS_SCRIPT_URL}?sheet=${AppState.aracSheetName}&row=${rowIndex}&sonuc=${encodeURIComponent(sonuc)}`;
        try {
            await fetch(url, { method: 'POST', mode: 'no-cors' });
        } catch (error) {
            console.error("API.updateGorevStatus hatası:", error);
            throw error;
        }
    }
};
