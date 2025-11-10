import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker ve işler.
 * @param {string} sheetName - Verilerin çekileceği sayfanın adı (örn: "OP-1").
 * @returns {Promise<Array>} - İşlenmiş görev nesnelerinden oluşan bir dizi.
 */
export async function fetchSheetData(sheetName) {
    const range = `${sheetName}!A4:P`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Sheets API Hatası: ${response.statusText}`);
        }
        const data = await response.json();
        const values = data.values || [];
        return processSheetData(values);
    } catch (error) {
        console.error("Veri çekme sırasında bir hata oluştu:", error);
        alert("Görev verileri yüklenemedi. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.");
        return [];
    }
}

/**
 * Ham E-Tablo verisini işleyerek temiz bir nesne dizisine dönüştürür.
 * @param {Array<Array<string>>} rows - E-Tablo'dan gelen satır verileri.
 * @returns {Array}
 */
/**
 * Ham E-Tablo verisini işleyerek temiz bir nesne dizisine dönüştürür.
 * @param {Array<Array<string>>} rows - E-Tablo'dan gelen satır verileri.
 * @returns {Array}
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING;

    rows.forEach((row, index) => {
        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {
            const formatCoordinate = (coord) => {
                if (!coord) return null;
                let str = String(coord).replace(/,/g, '').trim();
                if (!str.includes('.')) {
                    str = str.slice(0, 2) + '.' + str.slice(2);
                }
                const result = parseFloat(str);
                return isNaN(result) ? null : result;
            };

            const enlem = formatCoordinate(row[CM.ENLEM]);
            const boylam = formatCoordinate(row[CM.BOYLAM]);
            const tamAdres = row[CM.TAM_ADRES] || 'Adres Yok';
            
            // --- DEĞİŞİKLİK BURADA ---
            let mahalle = 'Diğer'; // Varsayılan değer
            // Adres içinde "MAH." kelimesi geçiyor mu diye kontrol et
            const mahIndex = tamAdres.toUpperCase().indexOf('MAH.');
            if (mahIndex !== -1) {
                // Eğer "MAH." bulunduysa, adresin başından o noktaya kadar olan kısmı al.
                // mahIndex + 4 -> "MAH." kelimesini de dahil etmek için.
                mahalle = tamAdres.substring(0, mahIndex + 4).trim();
            } else {
                // Eğer "MAH." yoksa, ilk virgüle kadar olan kısmı almayı dene
                const adresParcalari = tamAdres.split(',');
                if (adresParcalari[0]) {
                    mahalle = adresParcalari[0].trim();
                }
            }

            processedData.push({
                id: index + 4,
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                telefon: row[CM.TELEFON] || '',
                tamAdres: tamAdres,
                mahalle: mahalle, // Yeni ve daha doğru alınmış mahalle
                enlem: enlem,
                boylam: boylam,
                hasCoords: (enlem && boylam) ? true : false,
                durum: row[CM.DURUM]
            });
        }
    });

    return processedData;
}

