// =================================================================================
// == MODÜL: Harita Yönetimi (map.js) - v3 UYUMLU
// == Sorumluluk: Yandex Harita v3'ü oluşturur, marker'ları yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    // v3 için yeni durum değişkenleri
    userMarker: null,
    sonSecilenMarker: null,
    
    // Haritayı başlatan ana fonksiyon
    initMap: async function(elementId) {
        // v3'ün gerektirdiği modülleri import et
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
        // Kontroller ve standart marker'lar için dış paketi import et
        const { YMapZoomControl } = await ymaps3.import('@yandex/ymaps3-default-ui-theme');

        // Haritayı oluştur
        AppState.myMap = new YMap(document.getElementById(elementId), {
            location: AppConfig.MAP_DEFAULTS
        });

        // Haritanın görünmesi için temel katmanları ekle
        AppState.myMap.addChild(new YMapDefaultSchemeLayer({}));
        AppState.myMap.addChild(new YMapDefaultFeaturesLayer({}));

        // Standart zoom kontrolünü ekle
        AppState.myMap.addChild(new YMapZoomControl({}));

        // Haritaya tıklandığında, liste görünümündeyse harita görünümüne geç
        AppState.myMap.addChild(new ymaps3.YMapListener({
            onClick: () => {
                if (document.body.classList.contains('liste-odakli')) {
                    UI.toggleGorunum();
                }
            }
        }));

        // Kullanıcının konumunu izlemeye başla
        this.startGeolocation(YMapMarker);
    },

    // Kullanıcının konumunu izler
    startGeolocation: function(YMapMarker) {
        if (!navigator.geolocation) {
            console.warn("Bu tarayıcı Geolocation'ı desteklemiyor.");
            return;
        }

        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const userCoordinates = [longitude, latitude]; // v3 sırası [boylam, enlem]

                if (!this.userMarker) {
                    // Kullanıcı için özel bir HTML marker oluştur
                    const markerElement = document.createElement('div');
                    markerElement.className = 'user-marker'; // style.css'te stil eklenecek
                    
                    this.userMarker = new YMapMarker({
                        coordinates: userCoordinates,
                        zIndex: 9999 // Her şeyin üstünde olmalı
                    }, markerElement);
                    
                    AppState.myMap.addChild(this.userMarker);
                    console.log("Kullanıcı konumu haritaya eklendi.");
                } else {
                    // Marker zaten varsa, sadece konumunu güncelle
                    this.userMarker.update({ coordinates: userCoordinates });
                }
            },
            () => {
                console.warn("Konum izni alınamadı veya konum bulunamadı.");
            },
            { enableHighAccuracy: true }
        );
    },
    
    // Görev marker'larını haritaya çizer
    renderHarita: function(gorevListesi) {
        const { YMapMarker } = ymaps3;

        // Önceki tüm görev marker'larını temizle
        AppState.gorevMarkers.forEach(marker => AppState.myMap.removeChild(marker));
        AppState.gorevMarkers = [];
        this.sonSecilenMarker = null;

        gorevListesi.forEach(gorev => {
            // v3 koordinat sırası [boylam, enlem]
            if (gorev.boylam && gorev.enlem) {
                const markerElement = document.createElement('div');
                markerElement.className = 'gorev-marker'; // Stil eklenecek
                
                const marker = new YMapMarker({
                    coordinates: [gorev.boylam, gorev.enlem],
                    properties: { // Marker'a özel veri eklemek için
                        rowIndex: gorev.rowIndex,
                        mahalle: gorev.mahalle
                    },
                    zIndex: 100 // Görev marker'ları kullanıcıdan altta
                }, markerElement);

                // Marker'a tıklama olayı ekle
                marker.addChild(new ymaps3.YMapListener({
                    onClick: () => this.onMarkerClick(marker)
                }));

                AppState.gorevMarkers.push(marker);
                AppState.myMap.addChild(marker);
            }
        });
    },

    // Bir marker'a tıklandığında çalışacak fonksiyon
    onMarkerClick: function(marker) {
        const rowIndex = marker.properties.rowIndex;
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        
        // Eğer filtre seçiliyse ve tıklanan marker o filtreye ait değilse, filtreyi değiştir
        if (gorev && document.getElementById('mahalle-filtre').value !== gorev.mahalle) {
            document.getElementById('mahalle-filtre').value = gorev.mahalle;
            UI.filtrele();
        }

        this.vurgulaPin(marker);

        // Arayüzü güncelle
        UI.renderDetayPaneli(rowIndex);
        UI.vurgula(rowIndex);
    },

    // Rota Çizme (Şimdilik devre dışı)
    drawRoute: function(destinationCoords) {
        alert("Rota çizme özelliği, Haritalar API v3'te henüz doğrudan desteklenmemektedir.");
    },

    // Marker'ları mahalleye göre filtrele
    filtrele: function(secilenMahalle) {
        let boundsToShow = [];
        this.sonSecilenMarker = null;

        AppState.gorevMarkers.forEach(marker => {
            const pinMahalle = marker.properties.mahalle;
            const markerElement = marker.element;

            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                markerElement.className = 'gorev-marker'; // Normal renk
                markerElement.style.opacity = '1';
                boundsToShow.push(marker.coordinates);
            } else {
                markerElement.className = 'gorev-marker filtered-out'; // Soluk renk
                markerElement.style.opacity = '0.5';
            }
        });

        // Harita görünümünü filtrelenmiş marker'ları içerecek şekilde ayarla
        if (boundsToShow.length > 0) {
            AppState.myMap.update({
                location: {
                    bounds: boundsToShow,
                    duration: 500
                }
            });
        }
    },

    // Belirli bir göreve odaklan
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.boylam && gorev.enlem) {
            AppState.myMap.update({
                location: {
                    center: [gorev.boylam, gorev.enlem],
                    zoom: 17,
                    duration: 500
                }
            });

            const markerToSelect = AppState.gorevMarkers.find(m => m.properties.rowIndex === rowIndex);
            if (markerToSelect) {
                this.vurgulaPin(markerToSelect);
            }
        }
    },

    // Seçilen pini görsel olarak vurgula
    vurgulaPin: function(secilenMarker) {
        // Önceki seçili marker'ı normale döndür
        if (this.sonSecilenMarker) {
            const prevPinMahalle = this.sonSecilenMarker.properties.mahalle;
            const secilenMahalle = document.getElementById('mahalle-filtre').value;
            // Filtre durumuna göre doğru renge dönmesini sağla
            if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
                this.sonSecilenMarker.element.className = 'gorev-marker';
            } else {
                this.sonSecilenMarker.element.className = 'gorev-marker filtered-out';
            }
        }
        
        // Yeni marker'ı vurgula
        secilenMarker.element.className = 'gorev-marker selected';
        this.sonSecilenMarker = secilenMarker;
    },

    // Harita konteyneri yeniden boyutlandığında çağrılır
    boyutlandir: function() {
        if (AppState.myMap) {
            // v3'te bu genellikle otomatik yapılır, ancak manuel tetiklemek için:
            AppState.myMap.update({
                location: { ...AppState.myMap.location }
            });
        }
    }
};