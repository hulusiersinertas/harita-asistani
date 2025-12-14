import { fetchSheetData, fetchGuzergahData } from './modules/api.js';
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js';

// Sayfa tamamen yüklendiğinde çalışır
document.addEventListener('DOMContentLoaded', () => {
    // URL'den araç parametresi var mı kontrol et
    const params = new URLSearchParams(window.location.search);
    const urlArac = params.get('arac');

    if (urlArac) {
        // Parametre varsa direkt başlat
        const modal = document.getElementById('arac-secim-modal');
        if (modal) modal.style.display = 'none';
        baslat(urlArac);
    } else {
        // Yoksa butonları dinle
        const buttons = document.querySelectorAll('.arac-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const secilenArac = btn.getAttribute('data-arac');
                aracSecimIslemi(secilenArac);
            });
        });
    }
});

function aracSecimIslemi(secilenArac) {
    if (!secilenArac) return;

    // Modalı Gizle
    const modal = document.getElementById('arac-secim-modal');
    if (modal) {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '0';
        setTimeout(() => { 
            modal.style.display = 'none'; 
        }, 300);
    }

    // Başlat
    baslat(secilenArac);
}

// Uygulamanın Ana Başlatma Mantığı
async function baslat(aracAdi) {
    console.log("Uygulama başlatılıyor, Araç:", aracAdi);
    const baslik = document.getElementById('gorev-baslik');
    if (baslik) baslik.textContent = `${aracAdi} Yükleniyor...`;

    try {
        const [tumGorevler, guzergahSiralamasi] = await Promise.all([
            fetchSheetData(aracAdi),
            fetchGuzergahData(aracAdi)
        ]);
        
        // HARİTA İÇİN SADECE BEKLEYENLERİ SEÇ
        // Not: 'durum' alanını api.js içinde küçük harfe çevirmiştik
        const haritalikGorevler = tumGorevler.filter(g => g.durum === 'bekliyor');
        
        if (baslik) baslik.textContent = `${aracAdi} Görevleri`;
        const sayac = document.getElementById('kalan-gorev-sayaci');
        if (sayac) sayac.textContent = `Kalan: ${haritalikGorevler.length}`;
        
        if (tumGorevler.length === 0) {
            alert("Bu araç için kayıtlı görev bulunamadı veya veri çekilemedi.");
        }

        // initMap'e sadece bekleyenleri gönderiyoruz ki harita karışmasın
        const { map, placemarks } = await initMap(haritalikGorevler);
        
        // initUI'a ise TÜMÜNÜ gönderiyoruz (Geçmiş listesi ve yönetim için)
        initUI(tumGorevler, map, placemarks, aracAdi, guzergahSiralamasi);

    } catch (error) {
        console.error("Başlatma hatası:", error);
        alert("HATA: " + error.message);
        // Hata durumunda sayfayı yenilemeyelim ki hatayı görebilelim.
        // location.reload(); 
        
        // Eğer modal kapandıysa ve hata olduysa, kullanıcı sıkışmasın diye modalı geri açabiliriz:
        const modal = document.getElementById('arac-secim-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => { modal.style.opacity = '1'; }, 50);
        }
    }
}
