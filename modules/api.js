import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker.
 */
export async function fetchSheetData(sheetName) {
    // 1. GÜVENLİK: Sekme ismini tırnak içine al ('TP-2' gibi)
    const range = `'${sheetName}'!A4:P`;
    
    // 2. CACHE ÖNLEME: _t parametresini ekle
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}&_t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Hatası Detayı:", errorData);
            throw new Error(`Google API Hatası: ${response.status}`);
        }
        
        const data = await response.json();
        return processSheetData(data.values || []);
    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Veriler yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
        return [];
    }
}

/**
 * Ham E-Tablo verisini işler.
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    // --- YENİ EKLENEN TELEFON DÜZELTİCİ ---
    const formatTelefon = (raw) => {
        if (!raw) return '';
        // 1. Sadece rakamları bırak (Boşluk, parantez, tire hepsini sil)
        let clean = raw.toString().replace(/[^0-9]/g, '');

        // 2. Eğer 10 haneli ise ve 5 ile başlıyorsa (Örn: 5321234567) -> Başına 0 ekle
        if (clean.length === 10 && clean.startsWith('5')) {
            return '0' + clean;
        }
        // 3. Eğer 12 haneli ve 90 ile başlıyorsa (Örn: 90532...) -> 90'ı sil, 0 ekle
        if (clean.length === 12 && clean.startsWith('90')) {
            return '0' + clean.substring(2);
        }
        // 4. Zaten 11 haneli ve 0 ile başlıyorsa -> Dokunma
        if (clean.length === 11 && clean.startsWith('0')) {
            return clean;
        }
        
        // Hiçbiri değilse temiz halini döndür (En azından boşluksuz olsun)
        return clean;
    };

    rows.forEach((row, index) => {
        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {
            const formatCoordinate = (coord) => {
                if (!coord) return null;
                let str = String(coord).replace(/,/g, '').trim();
                // Binlik ayracı veya virgül hatası varsa düzelt (TR formatı için)
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
                
                // BURADA YENİ FONKSİYONU KULLANIYORUZ
                telefon: formatTelefon(row[CM.TELEFON]),
                
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
            return true;
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Sunucu hatası');
        }
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
        return false;
    }
}

/**
 * Güzergah verisini çeker
 */
export async function fetchGuzergahData(aracAdi) {
    const sheetName = 'Mahalleler Guzergah';
    const headerRange = `${sheetName}!A1:Z1`;
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${headerRange}?key=${config.googleApiKey}&_t=${Date.now()}`;

    try {
        const headerResponse = await fetch(headerUrl);
        if (!headerResponse.ok) return [];
        const headerData = await headerResponse.json();
        const headers = headerData.values[0];
        
        const aracIndex = headers.findIndex(h => h.trim().toUpperCase() === aracAdi.trim().toUpperCase());
        if (aracIndex === -1) return [];

        const aracColumn = String.fromCharCode(65 + aracIndex);
        const dataRange = `${sheetName}!${aracColumn}2:${aracColumn}`;
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${dataRange}?key=${config.googleApiKey}&_t=${Date.now()}`;
        
        const response = await fetch(dataUrl);
        if (!response.ok) return [];
        const data = await response.json();

        if (!data.values) return [];
        return data.values.map(row => row[0]).filter(Boolean);
        
    } catch (error) {
        console.error("Güzergah hatası:", error);
        return [];
    }
}
