// =================================================================================
// == MODÜL: Arayüz Yönetimi (ui.js) - v3 UYUMLU
// =================================================================================

const UI = {
    // Arayüz elemanlarını tek bir yerden yönetmek için
    elements: {
        body: document.body,
        aracBaslik: document.getElementById('arac-baslik'),
        gorevSayaci: document.getElementById('gorev-sayaci'),
        mahalleFiltre: document.getElementById('mahalle-filtre'),
        gorunumBtn: document.getElementById('gorunum-degistir-btn'),
        mapElement: document.getElementById('map'),
        gorevListesiTam: document.getElementById('gorev-listesi-tam'),
        gorevDetay: document.getElementById('gorev-detay')
    },

    // Uygulama başladığında çalışacak olay dinleyicileri
    initEventListeners: function() {
        this.elements.gorunumBtn.addEventListener('click', () => this.toggleGorunum());
        this.elements.mahalleFiltre.addEventListener('change', () => this.filtrele());
    },
    
    // Ana render fonksiyonu. Durum her değiştiğinde bu çağrılır.
    render: function() {
        const bekleyenGorevler = AppState.tumGorevler.filter(g => !g.gizli);
        this.elements.gorevSayaci.textContent = `Kalan: ${bekleyenGorevler.length}`;
        
        this.renderTamListe(bekleyenGorevler);
        MapManager.renderHarita(bekleyenGorevler);
        this.renderDetayPaneli(); // Başlangıçta boş detay paneli
        this.filtrele();
    },

    // Mahalle filtresini görev listesine göre doldurur
    mahalleFiltresiniDoldur: function(gorevListesi) {
        this.elements.mahalleFiltre.options.length = 1; // "Tüm Mahalleler" hariç temizle
        const mahalleler = [...new Set(gorevListesi.map(g => g.mahalle))].sort();
        mahalleler.forEach(mahalle => {
            if (mahalle && mahalle !== 'BİLİNMEYEN') {
                this.elements.mahalleFiltre.add(new Option(mahalle, mahalle));
            }
        });
    },

    // Alt paneldeki tam görev listesini oluşturur
    renderTamListe: function(gorevListesi) {
        this.elements.gorevListesiTam.innerHTML = '';
        gorevListesi.forEach(gorev => {
            const kart = document.createElement('div');
            kart.className = 'gorev-karti';
            kart.id = `liste-gorev-${gorev.rowIndex}`;
            kart.dataset.mahalle = gorev.mahalle;
            kart.onclick = () => this.listedenGorevSec(gorev.rowIndex);
            
            // Koordinatı olmayan görevleri görsel olarak işaretle
            if (!gorev.coordinates) {
                kart.classList.add('gorev-karti-hatali');
            }
            
            const miktarText = gorev.miktar ? ` (${gorev.miktar} Kişilik)` : '';
            const adresNotuHTML = gorev.adresNotu ? `<span class="adres-notu">${gorev.adresNotu.toUpperCase()}</span>` : '';

            kart.innerHTML = `<h3>${gorev.adSoyad}${miktarText}</h3>${adresNotuHTML}<p>${gorev.tamAdres}</p>`;
            this.elements.gorevListesiTam.appendChild(kart);
        });
    },

    // Alt paneldeki detay görünümünü oluşturur
    renderDetayPaneli: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);

        if (!gorev) {
            this.elements.gorevDetay.innerHTML = '<p style="color: #888;">Detayları görmek için haritadan veya listeden bir görev seçin.</p>';
            return;
        }
        
        // --- KRİTİK DEĞİŞİKLİK ---
        // Navigasyon linki oluşturulurken v3'ün [boylam, enlem] sırasına göre doğru koordinatlar kullanılıyor.
        // Yandex Haritalar URL'i hala [enlem, boylam] beklediği için sırayı burada çeviriyoruz.
        let navButon = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
        if (gorev.coordinates) {
            const enlem = gorev.coordinates[1];
            const boylam = gorev.coordinates[0];
            navButon = `<a href="https://yandex.com.tr/harita/?rtext=~${enlem},${boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>
                        <button class="buton" style="background-color: #7b1fa2;" onclick="UI.handleDrawRoute(${gorev.rowIndex})">Rota Çiz</button>`;
        }
        
        const adSoyadEscaped = gorev.adSoyad.replace(/'/g, "\\'");
        const miktarText = gorev.miktar ? ` (${gorev.miktar} Kişilik)` : '';
        const adresNotuHTML = gorev.adresNotu ? `<span class="adres-notu">${gorev.adresNotu.toUpperCase()}</span>` : '';

        this.elements.gorevDetay.innerHTML = `
            <h3>${gorev.adSoyad}${miktarText}</h3>
            ${adresNotuHTML}
            <p>${gorev.tamAdres}</p>
            <div class="buton-grup">${navButon}</div>
            <div class="buton-grup">
                <button class="buton verildi-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Verildi', '${adSoyadEscaped}')">Verildi</button>
                <button class="buton evde-yok-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Evde Yok', '${adSoyadEscaped}')">Evde Yok</button>
                <button class="buton" style="background-color: #fbc02d; color: black;" onclick="UI.handlePhoneCall('${gorev.telefon}')">Ara</button>
            </div>`;
    },

    // Harita ve liste üzerindeki filtrelemeyi uygular
    filtrele: function() {
        const secilenMahalle = this.elements.mahalleFiltre.value;
        MapManager.filtrele(secilenMahalle);
        document.querySelectorAll('#gorev-listesi-tam .gorev-karti').forEach(kart => {
            if (secilenMahalle === 'TUMU' || kart.dataset.mahalle === secilenMahalle) {
                kart.style.display = 'block';
            } else {
                kart.style.display = 'none';
            }
        });
    },

    // Rota Çiz butonuna basıldığında MapManager'ı çağırır
    handleDrawRoute: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        // MapManager'a koordinatları v3'ün beklediği [boylam, enlem] sırasıyla gönder
        if (gorev && gorev.coordinates) {
            MapManager.drawRoute(gorev.coordinates);
        }
    },

    // Görevin durumunu günceller (Verildi, Evde Yok vb.)
    updateGorev: async function(rowIndex, sonuc, adSoyad) {
        if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return;
        
        const gorevIndex = AppState.tumGorevler.findIndex(g => g.rowIndex === rowIndex);
        if (gorevIndex > -1) {
            AppState.tumGorevler[gorevIndex].gizli = true; // Görevi geçici olarak gizle
            this.render();
        }
        
        try {
            await API.updateGorevStatus(rowIndex, sonuc);
        } catch (error) {
            alert('Sunucuya bağlanırken hata oluştu. Lütfen tekrar deneyin.');
            // Hata olursa görevi tekrar görünür yap
            if (gorevIndex > -1) {
                AppState.tumGorevler[gorevIndex].gizli = false;
                this.render();
            }
        }
    },

    // Harita ve liste görünümü arasında geçiş yapar
    toggleGorunum: function() {
        this.elements.body.classList.toggle('liste-odakli');
        this.elements.body.classList.toggle('harita-odakli');

        if (this.elements.body.classList.contains('liste-odakli')) {
            this.elements.gorunumBtn.textContent = 'Haritayı Göster';
        } else {
            this.elements.gorunumBtn.textContent = 'Listeyi Göster';
        }
        // Haritanın boyutlarının yeniden hesaplanması için MapManager'ı bilgilendir
        setTimeout(() => MapManager.boyutlandir(), 400); // Animasyonun bitmesini bekle
    },

    // Listeden bir görev seçildiğinde çalışır
    listedenGorevSec: function(rowIndex) {
        MapManager.odaklan(rowIndex);
        this.renderDetayPaneli(rowIndex);
        if (this.elements.body.classList.contains('liste-odakli')) {
            this.toggleGorunum();
        }
        this.vurgula(rowIndex);
    },

    // Seçilen görevin kartını kısa süreliğine vurgular
    vurgula: function(rowIndex) {
        document.querySelectorAll('.vurgulandi').forEach(el => el.classList.remove('vurgulandi'));
        const kartElement = document.getElementById(`liste-gorev-${rowIndex}`);
        if (kartElement) {
            kartElement.classList.add('vurgulandi');
            setTimeout(() => kartElement.classList.remove('vurgulandi'), 1500);
        }
    },

    // Üst paneldeki araç başlığını ayarlar
    setAracBaslik: function(text) {
        this.elements.aracBaslik.textContent = text;
    },

    // Hata mesajı gösterir
    showError: function(message) {
        this.elements.gorevListesiTam.innerHTML = `<p style="color:red; padding: 20px;"><b>HATA:</b> ${message}</p>`;
    },

    // Telefon arama işlemini yönetir
    handlePhoneCall: function(phoneString) {
        if (!phoneString) { alert("Bu görev için kayıtlı bir telefon numarası yok."); return; }
        
        const phoneNumbers = phoneString.match(/0\d{9,10}/g) || [];
        if (phoneNumbers.length === 0) {
            alert(`Girilen metinde geçerli bir numara bulunamadı: "${phoneString}"`);
            return;
        }
        
        let numberToCall = phoneNumbers[0];
        if (phoneNumbers.length > 1) {
            const secim = prompt(`Birden fazla numara bulundu. Hangisi aranacak?\n\n${phoneNumbers.join("\n")}`, phoneNumbers[0]);
            if (secim && phoneNumbers.includes(secim)) {
                numberToCall = secim;
            } else {
                return; // Kullanıcı iptal etti veya geçersiz bir seçim yaptı
            }
        }
        
        if (confirm(`"${numberToCall}" numarası aranacak. Onaylıyor musunuz?`)) {
            window.location.href = `tel:${numberToCall}`;
        }
    }
};