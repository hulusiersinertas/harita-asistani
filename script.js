import { fetchSheetData } from './modules/api.js';
import { initMap } from './modules/map.js'; // map.js'i import et

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
    
    if (gorevler.length === 0) {
        console.log("Gösterilecek 'bekliyor' durumunda görev bulunamadı veya veri çekilemedi.");
        document.getElementById('gorev-baslik').textContent = `Görev Yok`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: 0`;
        return; // Görev yoksa devam etme
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
    document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${gorevler.length}`;
    console.log("Başarıyla çekilen ve işlenen görevler:", gorevler);

    // --- YENİ ADIM ---
    // 3. Haritayı başlat ve pinleri ekle
    const { map, placemarks } = await initMap(gorevler);
    
    // --- Sonraki adımlar buraya eklenecek ---
    // initUI(gorevler, map, placemarks);
}

// Uygulamayı başlat
main();
