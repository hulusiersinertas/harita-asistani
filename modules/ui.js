// =================================================================================
// == MODÜL: Arayüz Yönetimi (ui.js)
// =================================================================================

const UI = {
    elements: {
        body: document.body, aracBaslik: document.getElementById('arac-baslik'),
        gorevSayaci: document.getElementById('gorev-sayaci'), mahalleFiltre: document.getElementById('mahalle-filtre'),
        gorunumBtn: document.getElementById('gorunum-degistir-btn'), mapElement: document.getElementById('map'),
        gorevListesiTam: document.getElementById('gorev-listesi-tam'), gorevDetay: document.getElementById('gorev-detay')
    },

    initEventListeners: function() {
        this.elements.gorunumBtn.addEventListener('click', () => this.toggleGorunum());
        this.elements.mahalleFiltre.addEventListener('change', () => this.filtrele());
    },

    render: function() {
        const bekleyenGorevler = AppState.tumGorevler.filter(g => !g.gizli);
        this.elements.gorevSayaci.textContent = `Kalan: ${bekleyenGorevler.length}`;
        this.renderTamListe(bekleyenGorevler);
        MapManager.renderHarita(bekleyenGorevler);
        this.renderDetayPaneli();
        this.filtrele();
    },
    
    mahalleFiltresiniDoldur: function(gorevListesi) {
        this.elements.mahalleFiltre.options.length = 1;
        const mahalleler = [...new Set(gorevListesi.map(g => g.mahalle))].sort();
        mahalleler.forEach(mahalle => {
            if (mahalle && mahalle !== 'BİLİNMEYEN') this.elements.mahalleFiltre.add(new Option(mahalle, mahalle));
        });
    },

    renderTamListe: function(gorevListesi) {
        this.elements.gorevListesiTam.innerHTML = '';
        gorevListesi.forEach(gorev => {
            const kart = document.createElement('div');
            kart.className = 'gorev-karti'; kart.id = `liste-gorev-${gorev.rowIndex}`;
            kart.dataset.mahalle = gorev.mahalle; kart.onclick = () => this.listedenGorevSec(gorev.rowIndex);
            if (!gorev.enlem || !gorev.boylam) kart.classList.add('gorev-karti-hatali');
            kart.innerHTML = `<h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>`;
            this.elements.gorevListesiTam.appendChild(kart);
        });
    },

    renderDetayPaneli: function(rowIndex) {
    const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
    if (!gorev) { this.elements.gorevDetay.innerHTML = '<p style="color: #888;">Detayları görmek için bir nokta seçin.</p>'; return; }
    
    let navButon = `<button class="buton nav-buton" disabled>Konum Yok</button>`;
    if (gorev.enlem && gorev.boylam) { navButon = `<a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a>`; }
    
    const adSoyadEscaped = gorev.adSoyad.replace(/'/g, "\\'");
    this.elements.gorevDetay.innerHTML = `
        <h3>${gorev.adSoyad}</h3><p>${gorev.tamAdres}</p>
        <div class="buton-grup">
            ${navButon}
            <button class="buton" style="background-color: #fbc02d; color: black;" onclick="UI.handlePhoneCall('${gorev.telefon}')">Telefonla Ara</button>
        </div>
        <div class="buton-grup">
            <button class="buton verildi-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Verildi', '${adSoyadEscaped}')">Verildi</button>
            <button class="buton evde-yok-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Evde Yok', '${adSoyadEscaped}')">Evde Yok</button>
        </div>`;
},

    // YENİ FONKSİYON: "Rota Çiz" butonuna basıldığında çalışır
    handleDrawRoute: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            MapManager.drawRoute([gorev.enlem, gorev.boylam]); // Harita modülüne görevi ilet
        } else {
            alert("Bu görevin konumu bulunamadığı için rota çizilemiyor.");
        }
    },

    // ... Diğer tüm fonksiyonlar aynı ...
    filtrele: function() { const secilenMahalle = this.elements.mahalleFiltre.value; MapManager.filtreleHarita(secilenMahalle); document.querySelectorAll('#gorev-listesi-tam .gorev-karti').forEach(kart => { if (secilenMahalle === 'TUMU' || kart.dataset.mahalle === secilenMahalle) { kart.style.display = 'block'; } else { kart.style.display = 'none'; } }); },
   updateGorev: async function(rowIndex, sonuc, adSoyad) { 
    if (!confirm(`"${adSoyad}" için durum "${sonuc}" olarak güncellenecektir. Emin misiniz?`)) return; 
    if (AppState.myMap.balloon.isOpen()) AppState.myMap.balloon.close(); 
    const gorevIndex = AppState.tumGorevler.findIndex(g => g.rowIndex === rowIndex); 
    if (gorevIndex > -1) { AppState.tumGorevler[gorevIndex].gizli = true; this.render(); } 
    try { await API.updateGorevStatus(rowIndex, sonuc); } 
    catch (error) { 
        alert('Sunucuya bağlanırken hata oluştu.'); 
        if (gorevIndex > -1) { AppState.tumGorevler[gorevIndex].gizli = false; this.render(); } 
    } 
},
    toggleGorunum: function() { function onTransitionEnd() { MapManager.boyutlandir(); this.elements.mapElement.removeEventListener('transitionend', onTransitionEnd); } this.elements.mapElement.addEventListener('transitionend', onTransitionEnd.bind(this)); this.elements.body.classList.toggle('liste-odakli'); this.elements.body.classList.toggle('harita-odakli'); if (this.elements.body.classList.contains('liste-odakli')) { this.elements.gorunumBtn.textContent = 'Haritayı Göster'; } else { this.elements.gorunumBtn.textContent = 'Listeyi Göster'; } },
    listedenGorevSec: function(rowIndex) { MapManager.odaklan(rowIndex); this.renderDetayPaneli(rowIndex); if (this.elements.body.classList.contains('liste-odakli')) { this.toggleGorunum(); } this.vurgula(rowIndex); },
    vurgula: function(rowIndex) { document.querySelectorAll('.vurgulandi').forEach(el => el.classList.remove('vurgulandi')); const kartElement = document.getElementById(`liste-gorev-${rowIndex}`); if (kartElement) { kartElement.classList.add('vurgulandi'); setTimeout(() => { kartElement.classList.remove('vurgulandi'); }, 1500); } },
    setAracBaslik: function(text) { this.elements.aracBaslik.textContent = text; },
    showError: function(message) { this.elements.gorevListesiTam.innerHTML = `<p style="color:red;">${message}</p>`; }
    handlePhoneCall: function(phoneString) {
    if (!phoneString || phoneString.trim() === '') {
        alert("Bu kişi için kayıtlı bir telefon numarası bulunamadı.");
        return;
    }
    
    // Metinden tüm telefon numaralarını ayıkla (0 ile başlayan 10-11 haneli sayılar)
    const phoneNumbers = phoneString.match(/0\d{10}/g) || [];
    
    if (phoneNumbers.length === 0) {
        alert(`Kayıtlı metin içinde geçerli bir telefon numarası bulunamadı:\n"${phoneString}"`);
    } else if (phoneNumbers.length === 1) {
        // Tek numara varsa doğrudan ara
        window.location.href = `tel:${phoneNumbers[0]}`;
    } else {
        // Birden fazla numara varsa kullanıcıya seçtir
        const secim = prompt(`Birden fazla numara bulundu. Hangisini aramak istersiniz?\n\n${phoneNumbers.join("\n")}`, phoneNumbers[0]);
        if (secim && phoneNumbers.includes(secim)) {
            window.location.href = `tel:${secim}`;
        }
    }
}
};
window.UI = UI;

