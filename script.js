import { fetchSheetData, fetchGuzergahData } from './modules/api.js'; // fetchGuzergahData eklendi
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js';

async function main() {
    const params = new URLSearchParams(window.location.search);
    const aracAdi = params.get('arac');

    if (!aracAdi) {
        document.getElementById('gorev-baslik').textContent = "HATA";
        alert("Lütfen geçerli bir araç parametresi ile giriş yapın. (Örn: ?arac=OP-1)");
        return;
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri Yükleniyor...`;

    // Görevleri ve Güzergah verisini AYNI ANDA çekmek için Promise.all kullanıyoruz.
    // Bu, bekleme süresini kısaltır.
    const [gorevler, guzergahSiralamasi] = await Promise.all([
        fetchSheetData(aracAdi),
        fetchGuzergahData(aracAdi)
    ]);
    
    if (gorevler.length === 0) {
        document.getElementById('gorev-baslik').textContent = `Görev Yok`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: 0`;
        return;
    }
    
    document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
    document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${gorevler.length}`;
    console.log("Başarıyla çekilen ve işlenen görevler:", gorevler);
    console.log("Çekilen güzergah sırası:", guzergahSiralamasi);

    const { map, placemarks } = await initMap(gorevler);
    
    // Arayüzü başlatırken artık güzergah verisini de gönderiyoruz.
    initUI(gorevler, map, placemarks, aracAdi, guzergahSiralamasi);
}

main();
