// script.js (Güncellenmiş Hali)

import { fetchSheetData } from './modules/api.js';

// Uygulama başladığında çalışacak ana fonksiyon
async function main() {
    // 1. URL'den 'arac' parametresini al
    const params = new URLSearchParams(window.location.search);
    const aracAdi = params.get('arac');

    if (!aracAdi) {
        document.getElementById('gorev-baslik').textContent = "HATA";
        alert("Lütfen geçerli bir araç parametresi ile giriş yapın. (Örn: ?arac=OP-1)");
        return;
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri Yükleniyor...`;

    // 2. Google E-Tablosu'ndan verileri çek
    const gorevler = await fetchSheetData(aracAdi);

    // 3. (TEST AŞAMASI) Gelen verileri konsola yazdır
    if (gorevler.length > 0) {
        console.log("Başarıyla çekilen ve işlenen görevler:", gorevler); // BU SATIRIN ÇIKTISINI ARIYORUZ
        
        // alert(`${gorevler.length} adet görev başarıyla yüklendi. Detaylar için F12 ile konsolu kontrol edebilirsiniz.`); // Bu satırı geçici olarak devre dışı bıraktık
        
        document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${gorevler.length}`;
    } else {
        console.log("Gösterilecek 'bekliyor' durumunda görev bulunamadı veya veri çekilemedi.");
        document.getElementById('gorev-baslik').textContent = `Görev Yok`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: 0`;
    }
    
    // --- Sonraki adımlar buraya eklenecek ---
    // initMap(gorevler);
    // initUI(gorevler);
}

// Uygulamayı başlat
main();
