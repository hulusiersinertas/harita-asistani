import { updateGorevSirasi } from './api.js';

/**
 * Görevi rotaya ekler (En sona atar).
 */
export async function addToRoute(gorev, allTasks, aracAdi, onSuccess) {
    // Mevcut en büyük sıra numarasını bul (9999 olanlar hariç)
    const inRouteTasks = allTasks.filter(t => t.siraNo && t.siraNo < 9000);
    let maxSira = 0;
    if (inRouteTasks.length > 0) {
        maxSira = Math.max(...inRouteTasks.map(t => t.siraNo));
    }

    const newSira = maxSira + 1;
    gorev.siraNo = newSira;

    // UI Güncelle
    if (onSuccess) onSuccess();

    // API Güncelle
    await updateGorevSirasi(aracAdi, gorev.id, newSira);
}

/**
 * Görevi rotadan çıkarır (Sırasını 9999 yapar).
 */
export async function removeFromRoute(gorev, aracAdi, onSuccess) {
    if (!confirm("Bu görevi rotadan çıkarmak istediğinize emin misiniz?")) return;

    gorev.siraNo = 9999;
    if (onSuccess) onSuccess();
    await updateGorevSirasi(aracAdi, gorev.id, 9999);
}

/**
 * Görevin sırasını değiştirir (Yukarı/Aşağı butonları için).
 */
export async function moveTask(gorev, direction, allTasks, aracAdi, onSuccess) {
    if (!confirm(`Görevi ${direction === -1 ? 'yukarı' : 'aşağı'} taşımak istiyor musunuz?`)) return;

    const currentSira = gorev.siraNo;
    const targetSira = currentSira + direction;

    if (targetSira < 1) return; // 1'den küçüğe inemez

    // Hedef sırada başka bir görev var mı?
    const swapTask = allTasks.find(t => t.siraNo === targetSira && t.id !== gorev.id);

    // Yerel Değişiklik
    gorev.siraNo = targetSira;
    if (swapTask) {
        swapTask.siraNo = currentSira; // Yer değiştir
    }

    if (onSuccess) onSuccess();

    // API Güncellemeleri
    await updateGorevSirasi(aracAdi, gorev.id, targetSira);
    if (swapTask) {
        await updateGorevSirasi(aracAdi, swapTask.id, currentSira);
    }
}

/**
 * Elle sıra numarası girildiğinde çalışır. (Otomatik kaydırma yapar).
 */
export async function setManualSira(gorev, newSira, allTasks, aracAdi, onSuccess) {
    newSira = parseInt(newSira);
    if (isNaN(newSira) || newSira < 1) return;
    if (gorev.siraNo === newSira) return;

    // Çakışma kontrolü ve kaydırma mantığı
    // Eğer hedef sıra doluysa, o sıradaki ve ondan sonrakileri 1 artır.
    const tasksToShift = allTasks.filter(t => t.siraNo >= newSira && t.siraNo < 9000 && t.id !== gorev.id);
    
    // Önce kaydırılacakları güncelle (Yerel)
    tasksToShift.forEach(t => t.siraNo += 1);
    
    // Hedef görevi güncelle
    gorev.siraNo = newSira;

    if (onSuccess) onSuccess();

    // API Güncellemeleri (Toplu işlem olmadığı için tek tek atıyoruz, biraz maliyetli)
    await updateGorevSirasi(aracAdi, gorev.id, newSira);
    
    // Diğer kayanları güncelle
    for (const t of tasksToShift) {
        // Hızlı istek atarken sunucuyu yormamak için minik gecikme koyabiliriz
        updateGorevSirasi(aracAdi, t.id, t.siraNo); 
    }
}
