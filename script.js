import { fetchSheetData } from './modules/api.js';
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js'; // ui.js'i import et

// Uygulama başladığında çalışacak ana fonksiyon
async function main() {
    // 1. URL'den 'arac' parametresini al (Bu kısım aynı kalıyor)
    const params = new URLSearchParams(window.location.search);
    const aracAdi = params.get('arac');

    if (!aracAdi) {
        document.getElementById('gorev-baslik').textContent = "HATA";
        alert("Lütfen geçerli bir araç parametresi ile giriş yapın. (Örn: ?arac=OP-1)");
        return;
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri Yükleniyor...`;

    // 2. Google E-Tablosu'ndan verileri çek (Bu kısım aynı kalıyor)
    const gorevler = await fetchSheetData(aracAdi);
    
    if (gorevler.length === 0) {
        document.getElementById('gorev-baslik').textContent = `Görev Yok`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: 0`;
        return;
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
    document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${gorevler.length}`;
    console.log("Başarıyla çekilen ve işlenen görevler:", gorevler);

    // 3. Haritayı başlat ve pinleri ekle (Bu kısım aynı kalıyor)
    const { map, placemarks } = await initMap(gorevler);
    
    // --- YENİ ADIM ---
    // 4. Arayüzü başlat ve etkileşimleri ayarla
    initUI(gorevler, map, placemarks, aracAdi);
}

// Uygulamayı başlat
main();

