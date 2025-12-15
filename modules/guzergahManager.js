/**
 * GÜZERGAH YÖNETİCİSİ (YENİ SİSTEM)
 * Eski karmaşık mahalle/mesafe mantığı yerine,
 * doğrudan kullanıcının belirlediği SIRA NUMARASINA göre çalışır.
 */

/**
 * Sıradaki görevi bulur.
 * Kriterler:
 * 1. Durumu 'bekliyor' olmalı.
 * 2. Koordinatı olmalı.
 * 3. Rotaya ekli olmalı (Sıra No < 9000).
 * 4. En küçük sıra numarasına sahip olmalı.
 */
export function findNextGorev(allGorevler) {
    // 1. Adayları filtrele
    const routeTasks = allGorevler.filter(t => 
        t.durum === 'bekliyor' && 
        t.hasCoords && 
        t.siraNo && 
        t.siraNo < 9000
    );

    // 2. Sıra numarasına göre diz (1, 2, 3...)
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);

    // 3. Listenin en başındakini döndür
    if (routeTasks.length > 0) {
        const nextTask = routeTasks[0];
        console.log(`Sıradaki Hedef: [#${nextTask.siraNo}] ${nextTask.adSoyad}`);
        return nextTask;
    }

    // 4. Görev kalmadıysa null dön
    console.log("Güzergah tamamlandı. Sırada bekleyen görev yok.");
    return null;
}
