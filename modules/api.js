import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker.
 */
export async function fetchSheetData(sheetName) {
    // 1. GÜVENLİK: Sekme ismini tırnak içine alıyoruz.
    // 2. ARALIK: A4 yerine A1 yapıyoruz ki "Satır yok" hatası almayalım (Sonra filtreleyeceğiz).
    const range = `'${sheetName}'!A1:P`;
    
    // 3. CACHE ÖNLEME: _t parametresini ekliyoruz.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}&=${Date.now()}`;
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("API Hatası Detayı:", errorData);
            // Hatayı alert ile ekrana bas ki görelim
            throw new Error(`Google Hatası (${response.status}): ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        // Veri yoksa boş dizi gönder
        return processSheetData(data.values || []);

    } catch (error) {
        console.error("Veri çekme hatası:", error);
        alert(`Veri Çekme Hatası:\n${error.message}`);
        return [];
    }
}

/**
 * Ham E-Tablo verisini işler.
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    // --- TELEFON FORMATLAYICI FONKSİYON ---
    const formatTelefon = (raw) => {
        if (!raw) return '';
        let clean = raw.toString().replace(/[^0-9]/g, ''); // Sadece rakamlar
        
        if (clean.length === 10 && clean.startsWith('5')) return '0' + clean;
        if (clean.length === 12 && clean.startsWith('90')) return '0' + clean.substring(2);
        if (clean.length === 11 && clean.startsWith('0')) return clean;
        
        return clean; // Hiçbiri değilse temiz halini döndür
    };

    // --- KOORDİNAT FORMATLAYICI ---
    const formatCoordinate = (coord) => {
        if (!coord) return null;
        let str = String(coord).replace(/,/g, '').trim();
        // Eğer nokta yoksa (Örn: 321234) araya nokta koy (Basit düzeltme)
        if (!str.includes('.') && str.length > 2) {
            str = str.slice(0, 2) + '.' + str.slice(2);
        }
        const result = parseFloat(str);
        return isNaN(result) ? null : result;
    };

    // --- DÖNGÜ ---
    // Not: A1'den çektiğimiz için ilk 3 satır (Başlıklar vs.) gereksiz olabilir.
    // Veriler 4. satırdan (Index 3) başlar.
    rows.forEach((row, index) => {
        // İlk 3 satırı atla (Başlıklar)
        if (index < 3) return;

        // Durumu "bekliyor" olanları al
        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {
            
            const tamAdres = row[CM.TAM_ADRES] || 'Adres Yok';
            let mahalle = 'Diğer';
            
            // Mahalleyi ayıkla
            const mahIndex = tamAdres.toUpperCase().indexOf('MAH.');
            if (mahIndex !== -1) {
                mahalle = tamAdres.substring(0, mahIndex + 4).trim();
            } else {
                const adresParcalari = tamAdres.split(',');
                if (adresParcalari[0]) mahalle = adresParcalari[0].trim();
            }

            processedData.push({
                id: index + 1, // Excel satır numarası (Index 0 = Satır 1)
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                
                telefon: formatTelefon(row[CM.TELEFON]), // Telefonu düzelt
                
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
 * Google Apps Script'e durum güncellemesi gönderir.
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
 * Güzergah sıralamasını çeker.
 */
export async function fetchGuzergahData(aracAdi) {
    const sheetName = 'Mahalleler Guzergah';
    // Burada da güvenli aralık kullanıyoruz
    const headerRange = `'${sheetName}'!A1:Z1`;
    const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${headerRange}?key=${config.googleApiKey}&=${Date.now()}`;

    try {
        const headerResponse = await fetch(headerUrl);
        if (!headerResponse.ok) return [];
        const headerData = await headerResponse.json();
        const headers = headerData.values[0];
        
        const aracIndex = headers.findIndex(h => h.trim().toUpperCase() === aracAdi.trim().toUpperCase());
        if (aracIndex === -1) return [];

        const aracColumn = String.fromCharCode(65 + aracIndex);
        const dataRange = `'${sheetName}'!${aracColumn}2:${aracColumn}`;
        const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${dataRange}?key=${config.googleApiKey}&=${Date.now()}`;
        
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


