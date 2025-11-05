// =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// == Sorumluluk: Yandex Harita'yı oluşturur, pinleri yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    sonSecilenPlacemark: null,
    // YENİ DEĞİŞKENLER: Kullanıcı konumu ve rota için
    userPlacemark: null,
    currentUserLocation: null,
    currentRoute: null,

    initMap: function(elementId) {
        AppState.myMap = new ymaps.Map(elementId, {
            center: [39.7667, 30.5256], zoom: 12,
            controls: ['zoomControl', 'rulerControl', 'trafficControl', 'typeSelector', 'fullscreenControl']
        }, { 
            // Vektör harita modunu etkinleştir (3D özellikler ve daha akıcı render için)
            // Bu, rota çizimi gibi gelişmiş özelliklerle daha iyi çalışır.
            yandexMapAutoSwitch: true 
        });
        
        AppState.myMap.events.add('click', () => {
            if (document.body.classList.contains('liste-odakli')) UI.toggleGorunum();
        });
        
        // Harita hazır olduğunda, kullanıcının konumunu izlemeye başla
        this.startGeolocation();
    },

    // Kullanıcının konumunu izler
    startGeolocation: function() {
        const geolocation = ymaps.geolocation;
        
        // Konumu al ve haritaya kullanıcı pin'ini ekle
        geolocation.get({
            provider: 'browser',
            mapStateAutoApply: false // Haritayı otomatik olarak konuma odaklama
        }).then(result => {
            this.currentUserLocation = result.geoObjects.position;
            
            // Eğer daha önce bir kullanıcı pini varsa onu kaldır
            if (this.userPlacemark) {
                AppState.myMap.geoObjects.remove(this.userPlacemark);
            }

            this.userPlacemark = new ymaps.Placemark(this.currentUserLocation, {}, {
                preset: 'islands#geolocationIcon', // Konum için standart Yandex ikonu
                zIndex: 999 // Her zaman en üstte görünmesi için
            });
            AppState.myMap.geoObjects.add(this.userPlacemark);
            console.log("Kullanıcı konumu alındı ve haritaya eklendi.");

        }, () => {
            console.warn("Konum izni alınamadı veya konum bulunamadı.");
            alert("Uygulamanın tam olarak çalışabilmesi için konum izni vermeniz gerekmektedir.");
        });
    },

    // Kullanıcının konumu ile hedef arasına rota çizer
    drawRoute: function(destinationCoords) {
        if (!this.currentUserLocation) {
            alert("Henüz konumunuz tespit edilemedi. Lütfen biraz bekleyin veya konum izni verdiğinizden emin olun.");
            return;
        }

        // Varsa, eski rotayı haritadan kaldır
        if (this.currentRoute) {
            AppState.myMap.geoObjects.remove(this.currentRoute);
        }

        console.log("Rota çiziliyor...");
        // Yandex Router'ı kullanarak rota oluştur
        const multiRoute = new ymaps.multiRouter.MultiRoute({
            referencePoints: [
                this.currentUserLocation,
                destinationCoords
            ],
            params: {
                results: 1 // Sadece en iyi rotayı al
            }
        }, {
            boundsAutoApply: true, // Haritayı rotayı gösterecek şekilde ayarla
            routeActiveStrokeColor: "#dc3545", // Rota çizgisi rengi (kırmızı)
            routeActiveStrokeWidth: 5,
            routeStrokeStyle: "dot"
        });

        this.currentRoute = multiRoute;
        AppState.myMap.geoObjects.add(multiRoute);
    },

    // Görevleri harita üzerinde pin olarak çizer
    renderHarita: function(gorevListesi) {
    const myMap = AppState.myMap;
    myMap.geoObjects.removeAll();
    AppState.tumPlacemarks = [];
    this.sonSecilenPlacemark = null;

    const collection = new ymaps.GeoObjectCollection(null, {});

    gorevListesi.forEach(gorev => {
        if (gorev.enlem && gorev.boylam) {
            const placemark = new ymaps.Placemark(
                [gorev.enlem, gorev.boylam], 
                { rowIndex: gorev.rowIndex, mahalle: gorev.mahalle }, 
                { preset: 'islands#redDotIcon' } // Varsayılan stil: Kırmızı Nokta
            );
            placemark.events.add('click', (e) => {
                const targetPlacemark = e.get('target');
                const rowIndex = targetPlacemark.properties.get('rowIndex');
                this.vurgulaPin(targetPlacemark);
                UI.renderDetayPaneli(rowIndex);
                UI.vurgula(rowIndex);
            });
            AppState.tumPlacemarks.push(placemark);
            collection.add(placemark);
        }
    });
    if (collection.getLength() > 0) myMap.geoObjects.add(collection);
},

    // Haritadaki pinleri seçilen mahalleye göre vurgular/soluklaştırır
    filtreleHarita: function(secilenMahalle) {
    const boundsToShow = [];
    this.sonSecilenPlacemark = null;

    AppState.tumPlacemarks.forEach(placemark => {
        const pinMahalle = placemark.properties.get('mahalle');
        if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
            placemark.options.set('preset', 'islands#redDotIcon'); // Aktif stil: Kırmızı Nokta
            placemark.options.set('opacity', 1);
            if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') {
                boundsToShow.push(placemark.geometry.getCoordinates());
            }
        } else {
            placemark.options.set('preset', 'islands#yellowDotIcon'); // Pasif stil: Sarı Nokta
            placemark.options.set('opacity', 0.6);
        }
    });

    if (boundsToShow.length > 0) {
        AppState.myMap.setBounds(ymaps.util.bounds.fromPoints(boundsToShow), { checkZoomRange: true, zoomMargin: 40 });
    }
},

    // Haritayı belirtilen göreve odaklar ve pinini vurgular
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });
            const placemarkToSelect = AppState.tumPlacemarks.find(p => p.properties.get('rowIndex') === rowIndex);
            if (placemarkToSelect) this.vurgulaPin(placemarkToSelect);
        }
    },
    
    // Bir pini vurgulayan yardımcı fonksiyon
    vurgulaPin: function(secilenPlacemark) {
    const secilenMahalle = document.getElementById('mahalle-filtre').value;
    // Önceki seçimi, o anki filtre durumuna göre doğru renge döndür
    if (this.sonSecilenPlacemark) {
        const prevPinMahalle = this.sonSecilenPlacemark.properties.get('mahalle');
        if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
            this.sonSecilenPlacemark.options.set('preset', 'islands#redDotIcon');
        } else {
            this.sonSecilenPlacemark.options.set('preset', 'islands#yellowDotIcon');
        }
    }
    // Yeni seçilen pini vurgulu stile (parlak yeşil) çevir
    secilenPlacemark.options.set('preset', 'islands#greenIcon');
    this.sonSecilenPlacemark = secilenPlacemark;
},

    // Haritanın boyutunun değiştiğini API'ye bildirir
    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.container.fitToViewport();
        }
    }
};


