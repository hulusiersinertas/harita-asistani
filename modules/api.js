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


/**
 * "Mahalleler Guzergah" sayfasından belirtilen araç için mahalle sırasını çeker.
 * @param {string} aracAdi - (Örn: "OP-1")
 * @returns {Promise<Array<string>>} Mahalle isimlerinden oluşan bir dizi.
 */
export async function fetchGuzergahData(aracAdi) {
    const sheetName = 'Mahalleler Guzergah';
    const headerRange = `${sheetName}!A1:Z1`; // Araç adlarının olduğu başlık satırı
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${headerRange}?key=${config.googleApiKey}`;

    try {
        // 1. Başlık satırını çekerek doğru sütunu bul
        const headerResponse = await fetch(headerUrl);
        if (!headerResponse.ok) throw new Error('Güzergah başlıkları alınamadı.');
        const headerData = await headerResponse.json();
        const headers = headerData.values[0];
        
        const aracIndex = headers.findIndex(h => h.trim().toUpperCase() === aracAdi.trim().toUpperCase());
        if (aracIndex === -1) {
            console.warn(`'${sheetName}' sayfasında '${aracAdi}' için bir güzergah sütunu bulunamadı.`);
            return []; // Araç bulunamazsa boş bir güzergah döndür
        }

        // Sütun harfini hesapla (A=0, B=1, ...)
        const aracColumn = String.fromCharCode(65 + aracIndex);
        
        // 2. Bulunan sütundaki tüm mahalleleri çek (2. satırdan başlayarak)
        const dataRange = `${sheetName}!${aracColumn}2:${aracColumn}`;
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${dataRange}?key=${config.googleApiKey}`;
        
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error('Güzergah verisi alınamadı.');
        const data = await response.json();

        if (!data.values) return [];

        // Gelen veriyi [["mah1"], ["mah2"], ...] formatından ["mah1", "mah2"] formatına çevir
        return data.values.map(row => row[0]).filter(Boolean); // Boş satırları atla
        
    } catch (error) {
        console.error("Güzergah verisi çekme hatası:", error);
        alert("Güzergah listesi yüklenemedi. Özellik devre dışı kalabilir.");
        return []; // Hata durumunda boş güzergah döndür
    }
}
