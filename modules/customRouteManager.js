import { updateGorevSirasi } from './api.js';

/**
 * Görevi rotaya ekler (Listenin en sonuna atar).
 */
export async function addToRoute(gorev, allTasks, aracAdi, onSuccess) {
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    const newSira = routeTasks.length + 1;
    
    gorev.siraNo = newSira;

    if (onSuccess) onSuccess();
    await updateGorevSirasi(aracAdi, gorev.id, newSira);
}

/**
 * Görevi rotadan çıkarır (Sırasını 9999 yapar).
 */
export async function removeFromRoute(gorev, aracAdi, onSuccess) {
    if (!confirm("Bu görevi rotadan çıkarmak istediğinize emin misiniz?")) return;

    gorev.siraNo = 9999;
    
    // UI Güncelle
    if (onSuccess) onSuccess();

    // API Güncelle
    await updateGorevSirasi(aracAdi, gorev.id, 9999);
}

/**
 * OK TUŞLARI İLE TAŞIMA
 */
export async function moveTask(gorev, direction, allTasks, aracAdi, onSuccess) {
    // 1. Listeyi Hazırla
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);

    // 2. Mevcut İndeksi Bul
    const currentIndex = routeTasks.findIndex(t => t.id === gorev.id);
    if (currentIndex === -1) return;

    // 3. Hedef İndeksi Hesapla
    // Yön 1 (Yukarı Ok) -> İndeks Azalmalı (Listede yukarı çıkmalı)
    // Yön -1 (Aşağı Ok) -> İndeks Artmalı (Listede aşağı inmeli)
    // NOT: PanelManager'daki buton mantığına göre ayarladık.
    // Eğer butonlarınız ters çalışıyorsa buradaki -1 ve 1'i yer değiştirin.
    const moveAmount = direction === 1 ? -1 : 1; 
    const newIndex = currentIndex + moveAmount;

    // 4. Sınır Kontrolü
    if (newIndex < 0 || newIndex >= routeTasks.length) return;

    // 5. YER DEĞİŞTİRME VE KAYDIRMA (Kesin Çözüm)
    moveAndReindex(routeTasks, currentIndex, newIndex, aracAdi, onSuccess);
}

/**
 * ELLE SIRA NUMARASI GİRME (Otomatik Kaydırmalı)
 */
export async function setManualSira(gorev, newSiraInput, allTasks, aracAdi, onSuccess) {
    let targetSira = parseInt(newSiraInput);
    
    // Geçersiz giriş kontrolü
    if (isNaN(targetSira) || targetSira < 1) return;

    // 1. Listeyi Hazırla
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);

    // Eğer girilen sayı liste uzunluğundan büyükse, listenin sonuna at
    if (targetSira > routeTasks.length) targetSira = routeTasks.length;

    // 2. Mevcut İndeksi Bul
    const currentIndex = routeTasks.findIndex(t => t.id === gorev.id);
    if (currentIndex === -1) return;

    // 3. Hedef İndeksi Hesapla (Dizi indeksi 0'dan başlar, Sıra 1'den)
    // Örn: Sıra 3 olmak istiyorsa, indeks 2 olmalı.
    const targetIndex = targetSira - 1;

    // Aynı yere taşımaya çalışıyorsa işlem yapma
    if (currentIndex === targetIndex) return;

    // 4. YER DEĞİŞTİRME VE KAYDIRMA
    moveAndReindex(routeTasks, currentIndex, targetIndex, aracAdi, onSuccess);
}

/**
 * YARDIMCI FONKSİYON: Diziyi kes, yapıştır ve yeniden numaralandır.
 * Bu fonksiyon çakışmaları %100 önler.
 */
async function moveAndReindex(routeTasks, fromIndex, toIndex, aracAdi, onSuccess) {
    // 1. Öğeyi diziden söküp al (Splice)
    // [A, B, C] -> B'yi al -> [A, C] (Elimizde B var)
    const [movedTask] = routeTasks.splice(fromIndex, 1);

    // 2. Öğeyi yeni yerine sok (Insert)
    // [A, C] -> 0. indexe sok -> [B, A, C]
    routeTasks.splice(toIndex, 0, movedTask);

    // 3. RE-INDEXING (Yeniden Numaralandırma)
    // Listeyi baştan sona dönüp 1, 2, 3... veriyoruz.
    // Böylece B=1, A=2, C=3 olur. Çakışma imkansızdır.
    const updates = [];
    
    routeTasks.forEach((task, index) => {
        const finalSira = index + 1; // 1'den başlat
        
        // Sadece numarası değişenleri güncelleme listesine al
        if (task.siraNo !== finalSira) {
            task.siraNo = finalSira; // Yerel veriyi (RAM) güncelle
            updates.push(task);
        }
    });

    // 4. UI GÜNCELLEME (Anında tepki)
    if (onSuccess) onSuccess();

    // 5. API GÜNCELLEME (Değişenleri sunucuya bildir)
    // Promise.all kullanmıyoruz ki biri patlarsa hepsi patlamasın, sırayla gitsinler
    for (const task of updates) {
        // Hata yakalama ekleyerek döngünün kırılmasını önlüyoruz
        updateGorevSirasi(aracAdi, task.id, task.siraNo)
            .catch(err => console.error("Sıra API hatası:", task.adSoyad, err));
    }
}
