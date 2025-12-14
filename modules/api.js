import { config } from './config.js';

export async function fetchSheetData(sheetName) {
    // Aralığı R sütununa kadar genişlettik
    const range = `${sheetName}!A4:R`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Sheets API Hatası: ${response.statusText}`);
        const data = await response.json();
        return processSheetData(data.values || []);
    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert("Görev verileri yüklenemedi.");
        return [];
    }
}

function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    const formatTelefon = (raw) => {
        if (!raw) return '';
        let clean = raw.toString().replace(/[^0-9]/g, '');
        if (clean.length === 10 && clean.startsWith('5')) return '0' + clean;
        if (clean.length === 12 && clean.startsWith('90')) return '0' + clean.substring(2);
        if (clean.length === 11 && clean.startsWith('0')) return clean;
        return clean;
    };

    const formatCoordinate = (coord) => {
        if (!coord) return null;
        let str = String(coord).replace(/,/g, '').trim();
        if (!str.includes('.')) str = str.slice(0, 2) + '.' + str.slice(2);
        const result = parseFloat(str);
        return isNaN(result) ? null : result;
    };

    rows.forEach((row, index) => {
        // İsmi olan her satırı al
        if (row[CM.AD_SOYAD]) {
            const tamAdres = row[CM.TAM_ADRES] || 'Adres Yok';
            let mahalle = 'Diğer';
            
            const mahIndex = tamAdres.toUpperCase().indexOf('MAH.');
            if (mahIndex !== -1) {
                mahalle = tamAdres.substring(0, mahIndex + 4).trim();
            } else {
                const adresParcalari = tamAdres.split(',');
                if (adresParcalari[0]) mahalle = adresParcalari[0].trim();
            }

            // --- DURUM MANTIĞI (Flutter ile Eşlendi) ---
            const kDurum = row[CM.DURUM] ? row[CM.DURUM].trim() : '';
            const oSonuc = row[CM.SONUC] ? row[CM.SONUC].trim() : '';
            
            let finalDurum = 'bekliyor';
            
            if (kDurum.toLowerCase() === 'tamamlandı' && oSonuc !== '') {
                finalDurum = oSonuc; // "Verildi" veya "Evde Yok"
            } else if (kDurum !== '') {
                finalDurum = kDurum;
            }
            // -------------------------------------------

            let zaman = row[CM.ZAMAN] || '';
            let not = row[CM.NOT] || '';
            let sira = parseInt(row[CM.SIRA]) || 9999;

            processedData.push({
                id: index + 4,
                adSoyad: row[CM.AD_SOYAD],
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                telefon: formatTelefon(row[CM.TELEFON]),
                tamAdres: tamAdres,
                mahalle: mahalle,
                enlem: formatCoordinate(row[CM.ENLEM]),
                boylam: formatCoordinate(row[CM.BOYLAM]),
                hasCoords: !!(row[CM.ENLEM] && row[CM.BOYLAM]),
                
                durum: finalDurum,
                tamamlanmaZamani: zaman,
                not: not,
                siraNo: sira
            });
        }
    });

    return processedData;
}

export async function updateGorevStatus(sheetName, rowId, newStatus, note = null) {
    const formData = new FormData();
    formData.append('sheet', sheetName);
    formData.append('row', rowId);
    formData.append('sonuc', newStatus);
    if (note) formData.append('not', note);

    try {
        const response = await fetch(config.appsScriptUrl, {
            method: 'POST',
            body: formData,
        });
        if (response.ok || response.type === 'opaque' || response.type === 'cors') return true;
        else throw new Error('Sunucu hatası');
    } catch (error) {
        console.error('Durum güncelleme hatası:', error);
        return false;
    }
}

// Güzergah verisi çekme (Değişmedi ama dosya bütünlüğü için koydum)
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
        return [];
    }
}
