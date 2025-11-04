// =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// == Sorumluluk: Yandex Harita'yı oluşturur, pinleri yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    // Hangi pinin seçili olduğunu takip etmek için
    sonSecilenPlacemark: null,

    // Haritayı başlatır
    initMap: function(elementId) {
        AppState.myMap = new ymaps.Map(elementId, {
            center: [39.7667, 30.5256],
            zoom: 12,
            // Varsayılan kontrol setini kullanıyoruz
            controls: ['zoomControl', 'rulerControl', 'trafficControl', 'typeSelector', 'fullscreenControl']
        });
        
        // Haritaya tıklanınca (eğer liste modundaysa) harita moduna geri dön
        AppState.myMap.events.add('click', () => {
            if (document.body.classList.contains('liste-odakli')) {
                UI.toggleGorunum();
            }
        });
    },

    // Görevleri harita üzerinde pin olarak çizer
    renderHarita: function(gorevListesi) {
        const myMap = AppState.myMap;
        myMap.geoObjects.removeAll();
        AppState.tumPlacemarks = [];
        this.sonSecilenPlacemark = null; // Harita yenilendiğinde seçimi sıfırla

        const collection = new ymaps.GeoObjectCollection(null, {});

        gorevListesi.forEach(gorev => {
            if (gorev.enlem && gorev.boylam) {
                const placemark = new ymaps.Placemark(
                    [gorev.enlem, gorev.boylam], 
                    { 
                        rowIndex: gorev.rowIndex, 
                        mahalle: gorev.mahalle 
                    }, 
                    { 
                        preset: 'islands#blueCircleIcon'
                    }
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

        if (collection.getLength() > 0) {
            myMap.geoObjects.add(collection);
        }
    },

    // Haritadaki pinleri seçilen mahalleye göre vurgular/soluklaştırır
    filtreleHarita: function(secilenMahalle) {
        const boundsToShow = [];
        this.sonSecilenPlacemark = null; // Filtre değişince seçimi sıfırla

        AppState.tumPlacemarks.forEach(placemark => {
            const pinMahalle = placemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                placemark.options.set('preset', 'islands#blueCircleIcon'); // Varsayılan stil
                placemark.options.set('opacity', 1);
                if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') {
                    boundsToShow.push(placemark.geometry.getCoordinates());
                }
            } else {
                placemark.options.set('preset', 'islands#greyCircleIcon'); // Pasif stil
                placemark.options.set('opacity', 0.5);
            }
        });

        if (boundsToShow.length > 0) {
            AppState.myMap.setBounds(ymaps.util.bounds.fromPoints(boundsToShow), {
                checkZoomRange: true,
                zoomMargin: 40
            });
        }
    },

    // Haritayı belirtilen göreve odaklar ve pinini vurgular
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });

            const placemarkToSelect = AppState.tumPlacemarks.find(p => p.properties.get('rowIndex') === rowIndex);
            if (placemarkToSelect) {
                this.vurgulaPin(placemarkToSelect);
            }
        }
    },
    
    // Bir pini vurgulayan yardımcı fonksiyon
    vurgulaPin: function(secilenPlacemark) {
        if (this.sonSecilenPlacemark) {
            this.sonSecilenPlacemark.options.set('preset', 'islands#blueCircleIcon');
        }
        secilenPlacemark.options.set('preset', 'islands#redIcon'); // Seçili pini kırmızı raptiye yap
        this.sonSecilenPlacemark = secilenPlacemark;
    },

    // Haritanın boyutunun değiştiğini API'ye bildirir
    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.container.fitToViewport();
        }
    }
};
