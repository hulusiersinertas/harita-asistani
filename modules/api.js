import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker.
 * BU KISIM SİZİN GÖNDERDİĞİNİZ VE "ÇALIŞIYOR" DEDİĞİNİZ KODUN AYNISIDIR.
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
        alert("Görev verileri yüklenemedi. İnternet bağlantınızı kontrol edin ve sayfayı yenileyin.");
        return [];
    }
}

/**
 * Ham E-Tablo verisini işler.
 * TELEFON DÜZELTME BURADA YAPILIYOR
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    // --- TELEFON FORMATLAYICI (83 SORUNUNU ÇÖZER) ---
    const formatTelefon = (raw) => {
        if (!raw) return '';
        
        // 1. İçindeki her şeyi sil, sadece rakamları al
        let clean = raw.toString().replace(/[^0-9]/g, '');

        // 2. Başındaki gereksiz kodları (90, +90 vs) temizle ve 0 ekle
        if (clean.length === 10 && clean.startsWith('5')) return '0' + clean;
        if (clean.length === 12 && clean.startsWith('90')) return '0' + clean.substring(2);
        if (clean.length === 11 && clean.startsWith('0')) return clean;
        
        // Standart dışıysa bile en azından sadece rakam döndür
        return clean;
    };

    // Koordinat Formatlayıcı
    const formatCoordinate = (coord) => {
        if (!coord) return null;
        let str = String(coord).replace(/,/g, '').trim();
        if (!str.includes('.')) str = str.slice(0, 2) + '.' + str.slice(2);
        const result = parseFloat(str);
        return isNaN(result) ? null : result;
    };

    rows.forEach((row, index) => {
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
                id: index + 4,
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                
                // İŞTE BURASI: Numarayı temizleyerek kaydediyoruz
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
 * Durum güncelleme
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
 * Güzergah verisini çeker (Eski Yöntemle)
 */
export async function fetchGuzergahData(aracAdi) {
    const sheetName = 'Mahalleler Guzergah';
    const headerRange = `${sheetName}!A1:Z1`;
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${headerRange}?key=${config.googleApiKey}`;

    try {
        const headerResponse = await fetch(headerUrl);
        if (!headerResponse.ok) return [];
        const headerData = await headerResponse.json();
        const headers = headerData.values[0];
        
        const aracIndex = headers.findIndex(h => h.trim().toUpperCase() === aracAdi.trim().toUpperCase());
        if (aracIndex === -1) return [];

        const aracColumn = String.fromCharCode(65 + aracIndex);
        const dataRange = `${sheetName}!${aracColumn}2:${aracColumn}`;
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${dataRange}?key=${config.googleApiKey}`;
        
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
