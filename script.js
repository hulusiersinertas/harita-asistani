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
        const [tumGorevler, guzergahSiralamasi] = await Promise.all([
            fetchSheetData(aracAdi),
            fetchGuzergahData(aracAdi)
        ]);
        
        // HARİTA İÇİN SADECE BEKLEYENLERİ SEÇ
        const haritalikGorevler = tumGorevler.filter(g => g.durum === 'bekliyor');
        
        document.getElementById('gorev-baslik').textContent = `${aracAdi} Görevleri`;
        document.getElementById('kalan-gorev-sayaci').textContent = `Kalan: ${haritalikGorevler.length}`;
        
        // initMap'e sadece bekleyenleri gönderiyoruz
        const { map, placemarks } = await initMap(haritalikGorevler);
        
        // initUI'a ise TÜMÜNÜ gönderiyoruz (Geçmiş listesi için)
        initUI(tumGorevler, map, placemarks, aracAdi, guzergahSiralamasi);

    } catch (error) {
        console.error("Başlatma hatası:", error);
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

