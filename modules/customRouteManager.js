import { updateGorevSirasi } from './api.js';

/**
 * Görevi rotaya ekler (Listenin en sonuna atar).
 */
export async function addToRoute(gorev, allTasks, aracAdi, onSuccess) {
    // 1. Mevcut rotadaki görevleri bul
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    
    // 2. Yeni sıra numarası = Liste uzunluğu + 1
    const newSira = routeTasks.length + 1;
    
    gorev.siraNo = newSira;

    // UI Güncelle
    if (onSuccess) onSuccess();

    // API Güncelle
    await updateGorevSirasi(aracAdi, gorev.id, newSira);
}

/**
 * Görevi rotadan çıkarır (Sırasını 9999 yapar).
 * Not: ui.js'den liste gelmediği için boşlukları (1, 3, 4) kapatmaz, 
 * ancak bir sonraki taşıma işleminde liste otomatik düzelir.
 */
export async function removeFromRoute(gorev, aracAdi, onSuccess) {
    if (!confirm("Bu görevi rotadan çıkarmak istediğinize emin misiniz?")) return;

    gorev.siraNo = 9999;
    
    if (onSuccess) onSuccess();

    await updateGorevSirasi(aracAdi, gorev.id, 9999);
}

/**
 * GÖREVİ YUKARI / AŞAĞI TAŞIMA (Kesin Çözüm - Re-Indexing)
 */
export async function moveTask(gorev, direction, allTasks, aracAdi, onSuccess) {
    // 1. Rotadaki tüm görevleri al ve mevcut sırasına göre diz
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);

    // 2. Görevin şu anki dizindeki yerini bul
    const currentIndex = routeTasks.findIndex(t => t.id === gorev.id);
    if (currentIndex === -1) return; 

    // 3. Hedef İndeksi Hesapla (YÖN MANTIĞI BURADA)
    // direction = 1 (Yukarı Ok Butonu)  -> İndeksi AZALT (Listede yukarı çık, 5 iken 4 ol)
    // direction = -1 (Aşağı Ok Butonu) -> İndeksi ARTIR (Listede aşağı in, 4 iken 5 ol)
    // Not: PanelManager'da butonlara verdiğimiz data-dir ile burayı eşledik.
    
    // Eğer Yukarı Ok (1) ise yukarı (-1 index) gitmeli.
    // Eğer Aşağı Ok (-1) ise aşağı (+1 index) gitmeli.
    const moveAmount = direction === 1 ? -1 : 1; 
    const newIndex = currentIndex + moveAmount;

    // 4. Sınır Kontrolü (Listenin dışına çıkamaz)
    if (newIndex < 0 || newIndex >= routeTasks.length) return;

    // 5. DİZİDE YER DEĞİŞTİRME (Kritik Nokta)
    // Öğeyi eski yerinden sök
    routeTasks.splice(currentIndex, 1);
    // Öğeyi yeni yerine tak
    routeTasks.splice(newIndex, 0, gorev);

    // 6. YENİDEN NUMARALANDIRMA (Re-Indexing)
    // Diziyi baştan sona dönüp herkese 1, 2, 3 veriyoruz.
    // Böylece çakışma (iki tane 2 numara) olması imkansızlaşır.
    const updates = [];
    routeTasks.forEach((task, index) => {
        const targetSira = index + 1; // Dizi 0'dan başlar, sıra 1'den
        
        // Sadece numarası değişenleri güncelleme listesine al
        if (task.siraNo !== targetSira) {
            task.siraNo = targetSira; // Yerel veriyi güncelle
            updates.push(task);
        }
    });

    // 7. UI'ı hemen güncelle
    if (onSuccess) onSuccess();

    // 8. API'ye sadece değişenleri gönder
    for (const task of updates) {
        updateGorevSirasi(aracAdi, task.id, task.siraNo)
            .catch(err => console.error("Sıra güncelleme hatası:", err));
    }
}

/**
 * ELLE SIRA GİRİLDİĞİNDE (Araya Kayıt Atma ve Kaydırma)
 */
export async function setManualSira(gorev, newSiraInput, allTasks, aracAdi, onSuccess) {
    let targetSira = parseInt(newSiraInput);
    if (isNaN(targetSira) || targetSira < 1) return;

    // 1. Listeyi hazırla
    const routeTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    routeTasks.sort((a, b) => a.siraNo - b.siraNo);

    // Eğer hedef sıra listenin boyundan büyükse en sona at
    if (targetSira > routeTasks.length) targetSira = routeTasks.length;

    // 2. Mevcut konumdan çıkar
    const currentIndex = routeTasks.findIndex(t => t.id === gorev.id);
    if (currentIndex > -1) {
        routeTasks.splice(currentIndex, 1);
    }

    // 3. Hedef konuma ekle (İndeks = Sıra - 1)
    const targetIndex = targetSira - 1; 
    routeTasks.splice(targetIndex, 0, gorev);

    // 4. Yeniden Numaralandır (Zincirleme Kaydırma)
    const updates = [];
    routeTasks.forEach((task, index) => {
        const finalSira = index + 1;
        if (task.siraNo !== finalSira) {
            task.siraNo = finalSira;
            updates.push(task);
        }
    });

    if (onSuccess) onSuccess();

    // API Güncelle
    for (const task of updates) {
        updateGorevSirasi(aracAdi, task.id, task.siraNo)
            .catch(err => console.error(err));
    }
}
