// =================================================================================
// == MODÜL: Arayüz Yönetimi (ui.js)
// == Sorumluluk: HTML elemanlarını günceller, olayları dinler ve kullanıcı etkileşimlerini yönetir.
// =================================================================================

const UI = {
    // DOM Elemanlarını seç
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

    // Olay dinleyicilerini başlat
    initEventListeners: function() {
        this.elements.gorunumBtn.addEventListener('click', () => this.toggleGorunum());
        this.elements.mahalleFiltre.addEventListener('change', () => this.filtrele());
    },

    // Ana render fonksiyonu, tüm arayüzü yeniden çizer
    render: function() {
        const bekleyenGorevler = AppState.tumGorevler.filter(g => !g.gizli);
        this.elements.gorevSayaci.textContent = `Kalan: ${bekleyenGorevler.length}`;
        
        this.renderTamListe(bekleyenGorevler);
        MapManager.renderHarita(bekleyenGorevler);
        this.renderDetayPaneli();
        this.filtrele();
    },
    
    // Dropdown menüsünü doldurur
    mahalleFiltresiniDoldur: function(gorevListesi) {
        this.elements.mahalleFiltre.options.length = 1;
        const mahalleler = [...new Set(gorevListesi.map(g => g.mahalle))].sort();
        mahalleler.forEach(mahalle => {
            if (mahalle && mahalle !== 'BİLİNMEYEN') {
                this.elements.mahalleFiltre.add(new Option(mahalle, mahalle));
            }
        });
    },

    // Tam görev listesini oluşturur
    renderTamListe: function(gorevListesi) {
        this.elements.gorevListesiTam.innerHTML = '';
        gorevListesi.forEach(gorev => {
            const kart = document.createElement('div');
            kart.className = 'gorev-karti';
            kart.id = `liste-gorev-${gorev.rowIndex}`;
            kart.dataset.mahalle = gorev.mahalle;
            kart.onclick = () => this.listedenGorevSec(gorev.rowIndex);
            if (!gorev.enlem || !gorev.boylam) kart.classList.add('gorev-karti-hatali');
            kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
            this.elements.gorevListesiTam.appendChild(kart);
        });
    },

    // Detay panelini oluşturur
    renderDetayPaneli: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (!gorev) { this.elements.gorevDetay.innerHTML = '<p style="color: #888;">Detayları görmek için bir nokta seçin.</p>'; return; }
        
        let navButon = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
        if (gorev.enlem && gorev.boylam) { navButon = `<a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>`; }
        
        const adSoyadEscaped = gorev.adSoyad.replace(/'/g, "\\'");
        this.elements.gorevDetay.innerHTML = `
            <h3>${gorev.adSoyad}</h3>
            <p>${gorev.tamAdres}</p>
            <div class="buton-grup">
                ${navButon}
                <button class="buton" style="background-color: #fbc02d; color: black;" onclick="UI.handlePhoneCall('${gorev.telefon}')">Telefonla Ara</button>
            </div>
            <div class="buton-grup">
                <button class="buton verildi-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Verildi', '${adSoyadEscaped}')">Verildi</button>
                <button class="buton evde-yok-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Evde Yok', '${adSoyadEscaped}')">Evde Yok</button>
            </div>`;
    },

    // Filtreleme işlemini yönetir
    filtrele: function() {
        const secilenMahalle = this.elements.mahalleFiltre.value;
        MapManager.filtreleHarita(secilenMahalle);

        document.querySelectorAll('#gorev-listesi-tam .gorev-karti').forEach(kart => {
            if (secilenMahalle === 'TUMU' || kart.dataset.mahalle === secilenMahalle) {
                kart.style.display = 'block';
            } else {
                kart.style.display = 'none';
            }
        });
    },

    // Bir görevin durumunu günceller
    updateGorev: async function(rowIndex, sonuc, adSoyad) {
        if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return;
        
        if (AppState.myMap.balloon.isOpen()) AppState.myMap.balloon.close();

        const gorevIndex = AppState.tumGorevler.findIndex(g => g.rowIndex === rowIndex);
        if (gorevIndex > -1) {
            AppState.tumGorevler[gorevIndex].gizli = true; 
            this.render();
        }
        
        try {
            await API.updateGorevStatus(rowIndex, sonuc);
        } catch (error) {
            alert('Sunucuya bağlanırken hata oluştu.');
            if (gorevIndex > -1) {
                AppState.tumGorevler[gorevIndex].gizli = false;
                this.render();
            }
        }
    },

    // Görünümü değiştirir
    toggleGorunum: function() {
        function onTransitionEnd() { MapManager.boyutlandir(); this.elements.mapElement.removeEventListener('transitionend', onTransitionEnd); }
        this.elements.mapElement.addEventListener('transitionend', onTransitionEnd.bind(this));
        
        this.elements.body.classList.toggle('liste-odakli');
        this.elements.body.classList.toggle('harita-odakli');
        
        if (this.elements.body.classList.contains('liste-odakli')) {
            this.elements.gorunumBtn.textContent = 'Haritayı Göster';
        } else {
            this.elements.gorunumBtn.textContent = 'Listeyi Göster';
        }
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

    // Bir kartı geçici olarak vurgular
    vurgula: function(rowIndex) {
        document.querySelectorAll('.vurgulandi').forEach(el => el.classList.remove('vurgulandi'));
        const kartElement = document.getElementById(`liste-gorev-${rowIndex}`);
        if (kartElement) {
            kartElement.classList.add('vurgulandi');
            setTimeout(() => { kartElement.classList.remove('vurgulandi'); }, 1500);
        }
    },

    // Basit yardımcı fonksiyonlar
    setAracBaslik: function(text) { this.elements.aracBaslik.textContent = text; },
    showError: function(message) { this.elements.gorevListesiTam.innerHTML = `<p style="color:red;">${message}</p>`; },

    // Telefonla arama yardımcı fonksiyonu
    handlePhoneCall: function(phoneString) {
    if (!phoneString || phoneString.trim() === '') {
        alert("Bu kişi için kayıtlı bir telefon numarası bulunamadı.");
        return;
    }
    
    const phoneNumbers = phoneString.match(/0\d{9,10}/g) || [];
    
    if (phoneNumbers.length === 0) {
        alert(`Kayıtlı metin içinde geçerli bir telefon numarası bulunamadı:\n"${phoneString}"`);
        return; // İşlemi durdur
    } 
    
    let numberToCall;
    if (phoneNumbers.length === 1) {
        numberToCall = phoneNumbers[0];
    } else {
        const secim = prompt(`Birden fazla numara bulundu. Hangisini aramak istersiniz?\n\n${phoneNumbers.join("\n")}`, phoneNumbers[0]);
        if (secim && phoneNumbers.includes(secim)) {
            numberToCall = secim;
        } else {
            return; // Kullanıcı iptal ederse işlemi durdur
        }
    }

    // Arama yapmadan önce son bir onay al
    if (confirm(`"${numberToCall}" numarası aranacaktır. Onaylıyor musunuz?`)) {
        window.location.href = `tel:${numberToCall}`;
    }
};

// Fonksiyonları global scope'a taşıyoruz ki HTML içindeki onclick'ler çalışsın
window.UI = UI;

