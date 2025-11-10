import { config } from './config.js';

/**
 * Belirtilen Google E-Tablosu sayfasından görev verilerini çeker ve işler.
 * @param {string} sheetName - Verilerin çekileceği sayfanın adı (örn: "OP-1").
 * @returns {Promise<Array>} - İşlenmiş görev nesnelerinden oluşan bir dizi.
 */
export async function fetchSheetData(sheetName) {
    const range = `${sheetName}!A4:P`; // Veri aralığı
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.googleApiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Sheets API Hatası: ${response.statusText}`);
        }
        const data = await response.json();
        const values = data.values || [];

        // Gelen ham veriyi daha kullanışlı nesnelere dönüştürelim.
        return processSheetData(values);

    } catch (error) {
        console.error("Veri çekme sırasında bir hata oluştu:", error);
        alert("Görev verileri yüklenemedi. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.");
        return []; // Hata durumunda boş bir dizi döndür.
    }
}

/**
 * Ham E-Tablo verisini işleyerek temiz bir nesne dizisine dönüştürür.
 * @param {Array<Array<string>>} rows - E-Tablo'dan gelen satır verileri.
 * @returns {Array}
 */
function processSheetData(rows) {
    const processedData = [];
    const CM = config.COLUMN_MAPPING; // Sütun eşleştirmeleri için kısa yol

    rows.forEach((row, index) => {
        // Sadece durumu "bekliyor" olan görevleri alıyoruz.
        if (row[CM.DURUM] && row[CM.DURUM].toLowerCase() === 'bekliyor') {

            // --- DEĞİŞİKLİK BURADA BAŞLIYOR ---
            // Koordinatları temizleme ve normalleştirme fonksiyonu
            const formatCoordinate = (coord) => {
                if (!coord) return null;

                // 1. Gelen veriyi string'e çevir ve tüm virgülleri (binlik ayraçları) kaldır.
                //    Örn: "39,798,579" -> "39798579"
                //    Örn: "39,92077" -> "3992077"
                let str = String(coord).replace(/,/g, '').trim();
                
                // 2. Eğer sonuçta hala nokta yoksa (yani "39798579" formatındaysa),
                //    doğru yere noktayı ekle.
                if (!str.includes('.')) {
                    // Türkiye koordinatları genellikle 2 haneli derece ile başlar.
                    str = str.slice(0, 2) + '.' + str.slice(2);
                }
                
                const result = parseFloat(str);
                return isNaN(result) ? null : result;
            };
            // --- DEĞİŞİKLİK BURADA BİTİYOR ---

            const enlem = formatCoordinate(row[CM.ENLEM]);
            const boylam = formatCoordinate(row[CM.BOYLAM]);

            processedData.push({
                id: index + 4, 
                adSoyad: row[CM.AD_SOYAD] || 'İsim Yok',
                adresNotu: row[CM.ADRES_NOTU] || '',
                miktar: row[CM.MIKTAR] || '',
                telefon: row[CM.TELEFON] || '',
                tamAdres: row[CM.TAM_ADRES] || 'Adres Yok',
                mahalle: (row[CM.TAM_ADRES] || '').split('/').pop().trim(),
                enlem: enlem,
                boylam: boylam,
                hasCoords: (enlem && boylam) ? true : false,
                durum: row[CM.DURUM]
            });
        }
    });

    return processedData;
}
