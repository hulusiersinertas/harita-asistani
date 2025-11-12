/**
 * Bu modül, önceden tanımlanmış bir mahalle sırasına göre
 * bir sonraki hedefin hangisi olacağını belirleme mantığını yönetir.
 */

/**
 * İki coğrafi koordinat arasındaki mesafeyi (kilometre olarak) hesaplar.
 * Haversine formülü kullanılır.
 * @param {number} lat1 İlk noktanın enlemi
 * @param {number} lon1 İlk noktanın boylamı
 * @param {number} lat2 İkinci noktanın enlemi
 * @param {number} lon2 İkinci noktanın boylamı
 * @returns {number} İki nokta arasındaki mesafe (km)
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
 * Önce sıradaki ilk tamamlanmamış mahalleyi bulur,
 * sonra o mahalle içinde kullanıcının konumuna en yakın görevi seçer.
 * @param {[number, number]} userLocation Kullanıcının [boylam, enlem] konumu.
 * @param {Array<object>} allGorevler Henüz tamamlanmamış tüm görevlerin listesi.
 * @param {Array<string>} guzergahSiralamasi Mahalle isimlerinin sıralı listesi.
 * @returns {object | null} Bulunan en uygun görev veya görev kalmadıysa null.
 */
export function findNextGorev(userLocation, allGorevler, guzergahSiralamasi) {
    // 1. Güzergah listesindeki her mahalle için sırayla kontrol et
    for (const mahalle of guzergahSiralamasi) {
        // 2. O mahalleye ait tamamlanmamış görevleri bul
        const gorevlerBuMahallede = allGorevler.filter(g => g.mahalle.trim().toUpperCase() === mahalle.trim().toUpperCase() && g.hasCoords);

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
            return enYakinGorev; // En yakın görevi bulduk, fonksiyonu sonlandır.
        }
    }

    // 4. Döngü bitti ve hiçbir mahallede görev bulunamadıysa
    console.log("Güzergah tamamlandı. Bekleyen görev kalmadı.");
    return null;
}
