import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker.
 */
export async function fetchSheetData(sheetName) {
    // 1. ARALIK TANIMI: Güvenlik için tırnak ekliyoruz.
    const rawRange = `'${sheetName}'!A1:P`;
    
    // 2. KRİTİK DÜZELTME: URL'yi "encode" ediyoruz. 
    // Bu işlem ! işaretini %21, boşluğu %20 yapar. Google bunu sever.
    const encodedRange = encodeURIComponent(rawRange);
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodedRange}?key=${config.googleApiKey}&_t=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Hatası Detayı:", errorData);
            // Hatayı net görelim
            throw new Error(`Google API Hatası (${response.status}): ${errorData.error?.message}`);
        }
        
        const data = await response.json();
        return processSheetData(data.values || []);

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        
        // Kullanıcıya olası sebepleri söyleyelim
        let mesaj = `Veriler Yüklenemedi!\n\nHata: ${error.message}`;
        if (error.message.includes('INVALID_ARGUMENT') || error.message.includes('400')) {
             mesaj += `\n\nSebep: Sekme ismi ('${sheetName}') hatalı veya bulunamadı.`;
        } else if (error.message.includes('key')) {
             mesaj += `\n\nSebep: API Anahtarı hatalı. config.js dosyasını kontrol edin.`;
        }
        
        alert(mesaj);
        return [];
    }
}

/**
 * Ham E-Tablo verisini işler.
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    // Telefon Formatlayıcı
    const formatTelefon = (raw) => {
        if (!raw) return '';
        let clean = raw.toString().replace(/[^0-9]/g, '');
        if (clean.length === 10 && clean.startsWith('5')) return '0' + clean;
        if (clean.length === 12 && clean.startsWith('90')) return '0' + clean.substring(2);
        if (clean.length === 11 && clean.startsWith('0')) return clean;
        return clean;
    };

    // Koordinat Formatlayıcı
    const formatCoordinate = (coord) => {
        if (!coord) return null;
        let str = String(coord).replace(/,/g, '').trim();
        if (!str.includes('.') && str.length > 2) {
            str = str.slice(0, 2) + '.' + str.slice(2);
        }
        const result = parseFloat(str);
        return isNaN(result) ? null : result;
    };

    rows.forEach((row, index) => {
        // A1'den çektiğimiz için ilk 3 satır başlıktır, atla.
        if (index < 3) return;

        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {
            
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
                id: index + 1,
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
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

export async function fetchGuzergahData(aracAdi) {
    const sheetName = 'Mahalleler Guzergah';
    // Güzergah için de encodeURIComponent kullanıyoruz
    const rawRange = `'${sheetName}'!A1:Z1`;
    const encodedRange = encodeURIComponent(rawRange);
    
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodedRange}?key=${config.googleApiKey}&_t=${Date.now()}`;

    try {
        const headerResponse = await fetch(headerUrl);
        if (!headerResponse.ok) return [];
        const headerData = await headerResponse.json();
        const headers = headerData.values[0];
        
        const aracIndex = headers.findIndex(h => h.trim().toUpperCase() === aracAdi.trim().toUpperCase());
        if (aracIndex === -1) return [];

        const aracColumn = String.fromCharCode(65 + aracIndex);
        
        const rawDataRange = `'${sheetName}'!${aracColumn}2:${aracColumn}`;
        const encodedDataRange = encodeURIComponent(rawDataRange);
        
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodedDataRange}?key=${config.googleApiKey}&_t=${Date.now()}`;
        
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
