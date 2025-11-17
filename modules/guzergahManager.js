/**
 * Bu modül, önceden tanımlanmış bir mahalle sırasına göre
 * bir sonraki hedefin hangisi olacağını belirleme mantığını yönetir.
 */

/**
 * Mahalle isimlerini karşılaştırma için standart bir formata sokar.
 * Örnek: "Güllük Mah." -> "GÜLLÜK", "75.YIL (SULTANDERE) MAH." -> "75YILSULTANDERE"
 * @param {string} name - Ham mahalle adı.
 * @returns {string} Temizlenmiş ve standartlaştırılmış mahalle adı.
 */
function normalizeMahalleName(name) {
    if (!name) return '';
    return name
        .toLocaleUpperCase('tr-TR') // Türkçe karakterlere uygun büyük harf çevrimi
        .replace(/MAHALLESİ|MAH\.|MAH/g, '') // "MAHALLESİ", "MAH." veya "MAH" eklerini kaldır
        .replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '') // Harfler, sayılar ve Türkçe karakterler dışındaki her şeyi kaldır
        .trim();
}

/**
 * İki coğrafi koordinat arasındaki mesafeyi (kilometre olarak) hesaplar.
 * Haversine formülü kullanılır.
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat) / 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Belirtilen mahalle sırasına göre bir sonraki en uygun görevi bulur.
 */
export function findNextGorev(userLocation, allGorevler, guzergahSiralamasi) {
    // 1. Güzergah listesindeki her mahalle için sırayla kontrol et
    for (const guzergahMahalle of guzergahSiralamasi) {
        // GÜNCELLEME: Karşılaştırma için güzergahtaki mahalle adını temizle
        const normalizedGuzergahMahalle = normalizeMahalleName(guzergahMahalle);
        
        // 2. O mahalleye ait tamamlanmamış görevleri bul
        const gorevlerBuMahallede = allGorevler.filter(g => {
            // GÜNCELLEME: Karşılaştırma için görevdeki mahalle adını da temizle
            const normalizedGorevMahalle = normalizeMahalleName(g.mahalle);
            return normalizedGorevMahalle === normalizedGuzergahMahalle && g.hasCoords;
        });

        // 3. Eğer bu mahallede görev varsa, en yakın olanı bul ve döngüyü bitir
        if (gorevlerBuMahallede.length > 0) {
            let enYakinGorev = null;
            let enKisaMesafe = Infinity;
            const [userLon, userLat] = userLocation;

            gorevlerBuMahallede.forEach(gorev => {
                const mesafe = getDistance(userLat, userLon, gorev.enlem, gorev.boylam);
                if (mesafe < enKisaMesafe) {
                    enKisaMesafe = mesafe;
                    enYakinGorev = gorev;
                }
            });

            console.log(`Güzergahtaki bir sonraki hedef: ${enYakinGorev.mahalle} -> ${enYakinGorev.adSoyad} (${enKisaMesafe.toFixed(2)} km)`);
            return enYakinGorev;
        }
    }

    // 4. Döngü bitti ve hiçbir mahallede görev bulunamadıysa
    console.log("Güzergah tamamlandı. Bekleyen görev kalmadı.");
    return null;
}
