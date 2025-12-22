import { fetchSheetData, fetchGuzergahData } from './modules/api.js';
import { initMap } from './modules/map.js';
import { initUI } from './modules/ui.js';

// Sayfa tamamen yüklendiğinde çalışır
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. ÖNCE BUTONLARI DİNLEMEYE BAŞLA (HER DURUMDA ÇALIŞMALI)
    const buttons = document.querySelectorAll('.arac-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const secilenArac = btn.getAttribute('data-arac');
            aracSecimIslemi(secilenArac);
        });
    });

    // 2. Sol Üst Başlık (Left Pill) Tıklama Olayı
    const headerPill = document.querySelector('.left-pill');
    if (headerPill) {
        headerPill.addEventListener('click', () => {
            const modal = document.getElementById('arac-secim-modal');
            if (modal) {
                modal.style.display = 'flex';
                setTimeout(() => { modal.style.opacity = '1'; }, 10);
            }
        });
    }

    // 3. URL KONTROLÜ VE BAŞLATMA
    const params = new URLSearchParams(window.location.search);
    const urlArac = params.get('arac');

    if (urlArac) {
        // Parametre varsa direkt başlat ve modalı gizle
        const modal = document.getElementById('arac-secim-modal');
        if (modal) modal.style.display = 'none';
        baslat(urlArac);
    }
    // URL'de araç yoksa zaten modal görünür halde açılacak
    // ve kullanıcı butonlardan birini tıklayacak
});

function aracSecimIslemi(secilenArac) {
    if (!secilenArac) return;

    // Mevcut URL'deki aracı kontrol et
    const params = new URLSearchParams(window.location.search);
    const mevcutArac = params.get('arac');

    // Eğer şu anki araçtan FARKLI bir araç seçildiyse sayfayı o araçla yükle
    if (mevcutArac !== secilenArac) {
        // Tarayıcıyı yeni parametre ile yönlendir (Otomatik Refresh)
        window.location.search = `?arac=${secilenArac}`;
        return; 
    }

    // Eğer AYNI araç seçildiyse sadece modalı kapat
    const modal = document.getElementById('arac-secim-modal');
    if (modal) {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '0';
        setTimeout(() => { 
            modal.style.display = 'none'; 
        }, 300);
    }

    // Eğer sayfa ilk açılışıysa (URL'de parametre yoksa) başlat
    if (!mevcutArac) {
        baslat(secilenArac);
    }
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
        
        const haritalikGorevler = tumGorevler.filter(g => g.durum.toLowerCase() === 'bekliyor');
        
        if (baslik) baslik.textContent = `${aracAdi} Görevleri`;
        const sayac = document.getElementById('kalan-gorev-sayaci');
        if (sayac) sayac.textContent = `Kalan: ${haritalikGorevler.length}`;
        
        if (tumGorevler.length === 0) {
            alert("Bu araç için kayıtlı görev bulunamadı veya veri çekilemedi.");
        }

        const { map, placemarks } = await initMap(haritalikGorevler);
        
        // initUI'a tüm görevleri gönderiyoruz
        initUI(tumGorevler, map, placemarks, aracAdi, guzergahSiralamasi);

    } catch (error) {
        console.error("Başlatma hatası:", error);
        alert("HATA: " + error.message);
        
        const modal = document.getElementById('arac-secim-modal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => { modal.style.opacity = '1'; }, 50);
        }
    }
}

// FAB buton pozisyonunu ayarlamak için global fonksiyon
window.adjustFabPosition = (panelAcilikDurumu) => {
    const navBtn = document.getElementById('navigation-toggle-btn');
    const warningBtn = document.getElementById('no-coords-btn');
    
    if (!navBtn) return;
    
    if (panelAcilikDurumu) {
        // Panel açıksa butonları yukarı kaydır
        navBtn.style.transform = 'translateY(-50px)';
        if (warningBtn) warningBtn.style.transform = 'translateY(-50px)';
    } else {
        // Panel kapalıysa normal pozisyona döndür
        navBtn.style.transform = 'translateY(0)';
        if (warningBtn) warningBtn.style.transform = 'translateY(0)';
    }
};
