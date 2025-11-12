import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker.
 */
export async function fetchSheetData(sheetName) {
    const range = `${sheetName}!A4:P`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Sheets API Hatası: ${response.statusText}`);
        const data = await response.json();
        return processSheetData(data.values || []);
    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Görev verileri yüklenemedi. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.");
        return [];
    }
}

/**
 * Ham E-Tablo verisini işler.
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;
    rows.forEach((row, index) => {
        // --- DEĞİŞİKLİK BURADA: 'bekiyor' -> 'bekliyor' ---
        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {
            const formatCoordinate = (coord) => {
                if (!coord) return null;
                let str = String(coord).replace(/,/g, '').trim();
                if (!str.includes('.')) str = str.slice(0, 2) + '.' + str.slice(2);
                const result = parseFloat(str);
                return isNaN(result) ? null : result;
            };
            const tamAdres = row[CM.TAM_ADRES] || 'Adres Yok';
            let mahalle = 'Diğer';
            const mahIndex = tamAdres.toUpperCase().indexOf('MAH.');
            if (mahIndex !== -1) {
                mahalle = tamAdres.substring(0, mahIndex + 4).trim();
            } else {
                const adresParcalari = tamAdres.split(',');
                if (adresParcalari[0]) mahalle = adresParcalari[0].trim();
            }
            processedData.push({
                id: index + 4,
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                telefon: row[CM.TELEFON] || '',
                tamAdres: tamAdres,
                mahalle: mahalle,
                enlem: formatCoordinate(row[CM.ENLEM]),
                boylam: formatCoordinate(row[CM.BOYLAM]),
                hasCoords: !!(row[CM.ENLEM] && row[CM.BOYLAM]),
                durum: row[CM.DURUM]
            });
        }
    });
    return processedData;
}


/**
 * Google Apps Script'e bir POST isteği göndererek görev durumunu günceller.
 */
export async function updateGorevStatus(sheetName, rowId, newStatus) {
    const formData = new FormData();
    formData.append('sheet', sheetName);
    formData.append('row', rowId);
    formData.append('sonuc', newStatus);

    try {
        const response = await fetch(config.appsScriptUrl, {
            method: 'POST',
            body: formData,
        });
        
        if (response.ok || response.type === 'opaque' || response.type === 'cors') {
            console.log(`Görev ${rowId} durumu "${newStatus}" olarak güncellendi.`);
            return true;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Bilinmeyen bir sunucu hatası oluştu.');
        }
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
        alert(`Durum güncellenemedi: ${error.message}`);
        return false;
    }
}
