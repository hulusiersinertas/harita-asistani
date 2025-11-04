// =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// == Sorumluluk: Yandex Harita'yı oluşturur, pinleri yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    // Haritayı başlatır
    initMap: function(elementId) {
        AppState.myMap = new ymaps.Map(elementId, {
            center: [39.7667, 30.5256],
            zoom: 12
        });
    },

    // Görevleri harita üzerinde pin olarak çizer
    renderHarita: function(gorevListesi) {
        const myMap = AppState.myMap;
        myMap.geoObjects.removeAll();
        AppState.tumPlacemarks = [];

        const collection = new ymaps.GeoObjectCollection(null, {});

        gorevListesi.forEach(gorev => {
            if (gorev.enlem && gorev.boylam) {
                const adSoyadEscaped = gorev.adSoyad.replace(/'/g, "\\'");
                const balloonLayoutString = `<div class="balloon-content"><h4>${gorev.adSoyad}</h4><p>${gorev.tamAdres}</p><div class="buton-grup"><button class="buton verildi-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Verildi', '${adSoyadEscaped}')">Verildi</button><button class="buton evde-yok-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Evde Yok', '${adSoyadEscaped}')">Evde Yok</button></div><div class="buton-grup" style="margin-top: 8px;"><a href="https://yandex.com.tr/harita/?rtext=~${gorev.enlem},${gorev.boylam}" target="_blank" class="buton nav-buton">Navigasyon</a><button class="buton diger-buton" onclick="UI.updateGorev(${gorev.rowIndex}, 'Adres Yanlış', '${adSoyadEscaped}')">Adres Y.</button></div></div>`;
                const BalloonContentLayout = ymaps.templateLayoutFactory.createClass(balloonLayoutString);
                
                const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], 
                    { rowIndex: gorev.rowIndex, mahalle: gorev.mahalle }, 
                    { preset: 'islands#blueDotIcon', balloonContentLayout: BalloonContentLayout, balloonPanelMaxMapArea: 0 }
                );
                
                placemark.events.add('click', (e) => {
                    const rowIndex = e.get('target').properties.get('rowIndex');
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
        AppState.tumPlacemarks.forEach(placemark => {
            const pinMahalle = placemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                placemark.options.set('preset', 'islands#blueDotIcon');
                placemark.options.set('opacity', 1);
                if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') {
                    boundsToShow.push(placemark.geometry.getCoordinates());
                }
            } else {
                placemark.options.set('preset', 'islands#greyDotIcon');
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

    // Haritayı belirtilen göreve odaklar
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });
        }
    },

    // Haritanın boyutunun değiştiğini API'ye bildirir
    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.container.fitToViewport();
        }
    }
};