import { fetchSheetData, fetchGuzergahData } from './modules/api.js';
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js';

// GLOBAL FONKSİYON: Buton tıklanınca çalışır
window.aracSec = function(secilenArac) {
    if (!secilenArac) return;

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
            alert("Bu araç için kayıtlı görev bulunamadı.");
            return;
        }
        
        document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${gorevler.length}`;
        
        const { map, placemarks } = await initMap(gorevler);
        initUI(gorevler, map, placemarks, aracAdi, guzergahSiralamasi);

    } catch (error) {
        console.error("Başlatma hatası:", error);
        // Hatayı ekranda da gösterelim ki ne olduğunu anlayalım
        alert("Veriler yüklenirken hata oluştu: " + error.message);
        location.reload();
    }
}

// Uygulama ilk açıldığında çalışacak kod
function initApp() {
    const params = new URLSearchParams(window.location.search);
    const urlArac = params.get('arac');

    if (urlArac) {
        document.getElementById('arac-secim-modal').style.display = 'none';
        baslat(urlArac);
    } 
    // APK veya normal web girişinde modal açık kalır, kullanıcı butona basınca window.aracSec çalışır.
}

// Başlat
initApp();
