import { fetchSheetData, fetchGuzergahData } from './modules/api.js';
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js';

// GLOBAL FONKSİYON: Buton tıklanınca çalışır
window.aracSec = function(secilenArac) {
    if (!secilenArac) return;

    // NOT: localStorage satırlarını sildik. Artık kaydetmeyecek.

    // 1. Modalı Efektli Gizle
    const modal = document.getElementById('arac-secim-modal');
    if (modal) {
        modal.style.opacity = '0';
        // Animasyon bitince (300ms) display none yap
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }

    // 2. Uygulamayı Seçilen Araçla Başlat
    baslat(secilenArac);
};

// Uygulamanın Ana Başlatma Mantığı
async function baslat(aracAdi) {
    console.log("Uygulama başlatılıyor, Araç:", aracAdi);

    document.getElementById('gorev-baslik').textContent = `${aracAdi} Yükleniyor...`;

    try {
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
        
        const { map, placemarks } = await initMap(gorevler);
        initUI(gorevler, map, placemarks, aracAdi, guzergahSiralamasi);

    } catch (error) {
        console.error("Başlatma hatası:", error);
        alert("Veriler yüklenirken hata oluştu. İnternet bağlantınızı kontrol edin.");
        // Hata olursa sayfayı yenilemek isteyebilirler
        location.reload();
    }
}

// Uygulama ilk açıldığında çalışacak kod
function initApp() {
    // Sadece Web sürümü testi için URL kontrolü bırakıyoruz.
    // APK'da URL parametresi olmayacağı için burası her zaman es geçilecek
    // ve direkt Modal ekranda kalacaktır.
    const params = new URLSearchParams(window.location.search);
    const urlArac = params.get('arac');

    if (urlArac) {
        // Eğer web tarayıcısında ?arac=OP-1 diye elle yazıldıysa modalı gösterme
        document.getElementById('arac-secim-modal').style.display = 'none';
        baslat(urlArac);
    } 
    
    // APK modunda 'else' durumuna düşer. 
    // HTML'de modal varsayılan olarak açık olduğu için (display: flex),
    // kullanıcı seçim yapana kadar ekran öylece bekler.
}

// Başlat
initApp();