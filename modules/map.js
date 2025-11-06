// =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// == Sorumluluk: Yandex Harita'yı oluşturur, pinleri yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    sonSecilenPlacemark: null,
    userPlacemark: null,
    currentUserLocation: null,
    currentRoute: null,

    // =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// == Sorumluluk: Yandex Harita'yı oluşturur, pinleri yönetir ve harita etkileşimlerini sağlar.
// =================================================================================

const MapManager = {
    sonSecilenPlacemark: null,
    userPlacemark: null,
    currentUserLocation: null,
    currentRoute: null,

    initMap: function(elementId) {
        AppState.myMap = new ymaps.Map(elementId, {
            center: [39.7667, 30.5256],
            zoom: 12,
            controls: ['zoomControl', 'rulerControl', 'trafficControl', 'typeSelector', 'fullscreenControl']
        }, { 
            yandexMapAutoSwitch: true 
        });
        
        AppState.myMap.events.add('click', () => {
            if (document.body.classList.contains('liste-odakli')) {
                UI.toggleGorunum();
            }
        });
        
        this.startGeolocation();
    },

    startGeolocation: function() {
        ymaps.geolocation.get({ provider: 'browser', mapStateAutoApply: false }).then(result => {
            this.currentUserLocation = result.geoObjects.position;
            if (this.userPlacemark) {
                AppState.myMap.geoObjects.remove(this.userPlacemark);
            }
            this.userPlacemark = new ymaps.Placemark(this.currentUserLocation, {}, {
                preset: 'islands#geolocationIcon',
                zIndex: 999
            });
            AppState.myMap.geoObjects.add(this.userPlacemark);
            console.log("Kullanıcı konumu alındı ve haritaya eklendi.");
        }, () => {
            console.warn("Konum izni alınamadı veya konum bulunamadı.");
        });
    },

    drawRoute: function(destinationCoords) {
        if (!this.currentUserLocation) {
            alert("Henüz konumunuz tespit edilemedi. Lütfen biraz bekleyin veya konum izni verdiğinizden emin olun.");
            return;
        }
        if (this.currentRoute) {
            AppState.myMap.geoObjects.remove(this.currentRoute);
        }
        const multiRoute = new ymaps.multiRouter.MultiRoute({
            referencePoints: [
                this.currentUserLocation,
                destinationCoords
            ],
            params: { results: 1 }
        }, {
            boundsAutoApply: true,
            routeActiveStrokeColor: "#dc3545",
            routeActiveStrokeWidth: 5
        });
        this.currentRoute = multiRoute;
        AppState.myMap.geoObjects.add(multiRoute);
    },

    renderHarita: function(gorevListesi) {
        const myMap = AppState.myMap;
        myMap.geoObjects.each(go => {
            if (go !== this.userPlacemark && go !== this.currentRoute) {
                myMap.geoObjects.remove(go);
            }
        });
        AppState.tumPlacemarks = [];
        this.sonSecilenPlacemark = null;

        const collection = new ymaps.GeoObjectCollection(null, {});
        gorevListesi.forEach(gorev => {
            if (gorev.enlem && gorev.boylam) {
                const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], {
                    rowIndex: gorev.rowIndex,
                    mahalle: gorev.mahalle
                }, {
                    preset: 'islands#redDotIcon'
                });
                placemark.events.add('click', (e) => {
                    const targetPlacemark = e.get('target');
                    const rowIndex = targetPlacemark.properties.get('rowIndex');
                    const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
                    if (gorev && document.getElementById('mahalle-filtre').value !== gorev.mahalle) {
                        document.getElementById('mahalle-filtre').value = gorev.mahalle;
                        UI.filtrele();
                    }
                    // =========================================================================
                    // ==== YAZIM HATASI BURADA DÜZELTİLDİ ====
                    // =========================================================================
                    this.vurgulaPin(targetPlacemark); // Eksik olan parantez ')' eklendi.
                    // =========================================================================
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

    filtrele: function(secilenMahalle) {
        const boundsToShow = [];
        this.sonSecilenPlacemark = null;
        AppState.tumPlacemarks.forEach(placemark => {
            const pinMahalle = placemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                placemark.options.set('preset', 'islands#redDotIcon');
                placemark.options.set('opacity', 1);
                if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') {
                    boundsToShow.push(placemark.geometry.getCoordinates());
                }
            } else {
                placemark.options.set('preset', 'islands#yellowDotIcon');
                placemark.options.set('opacity', 0.6);
            }
        });
        if (boundsToShow.length > 0) {
            if (secilenMahalle === 'TUMU') {
                AppState.myMap.setBounds(ymaps.util.bounds.fromPoints(boundsToShow), { checkZoomRange: true, zoomMargin: 40 });
            } else {
                const center = ymaps.util.bounds.getCenter(ymaps.util.bounds.fromPoints(boundsToShow));
                AppState.myMap.setCenter(center, 15, { duration: 500 });
            }
        }
    },
    
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 16, { duration: 500 });
            const placemarkToSelect = AppState.tumPlacemarks.find(p => p.properties.get('rowIndex') === rowIndex);
            if (placemarkToSelect) {
                this.vurgulaPin(placemarkToSelect);
            }
        }
    },
    
    vurgulaPin: function(secilenPlacemark) {
        const secilenMahalle = document.getElementById('mahalle-filtre').value;
        if (this.sonSecilenPlacemark) {
            const prevPinMahalle = this.sonSecilenPlacemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
                this.sonSecilenPlacemark.options.set('preset', 'islands#redDotIcon');
            } else {
                this.sonSecilenPlacemark.options.set('preset', 'islands#yellowDotIcon');
            }
        }
        secilenPlacemark.options.set('preset', 'VioletSouvenirsCircleIcon');
        this.sonSecilenPlacemark = secilenPlacemark;
    },

    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.container.fitToViewport();
        }
    }
};


    startGeolocation: function() {
        ymaps.geolocation.get({ provider: 'browser', mapStateAutoApply: false }).then(result => {
            this.currentUserLocation = result.geoObjects.position;
            if (this.userPlacemark) {
                AppState.myMap.geoObjects.remove(this.userPlacemark);
            }
            this.userPlacemark = new ymaps.Placemark(this.currentUserLocation, {}, {
                preset: 'islands#geolocationIcon',
                zIndex: 999
            });
            AppState.myMap.geoObjects.add(this.userPlacemark);
            console.log("Kullanıcı konumu alındı ve haritaya eklendi.");
        }, () => {
            console.warn("Konum izni alınamadı veya konum bulunamadı.");
        });
    },

    drawRoute: function(destinationCoords) {
        if (!this.currentUserLocation) {
            alert("Henüz konumunuz tespit edilemedi. Lütfen biraz bekleyin veya konum izni verdiğinizden emin olun.");
            return;
        }
        if (this.currentRoute) {
            AppState.myMap.geoObjects.remove(this.currentRoute);
        }
        const multiRoute = new ymaps.multiRouter.MultiRoute({
            referencePoints: [
                this.currentUserLocation,
                destinationCoords
            ],
            params: { results: 1 }
        }, {
            boundsAutoApply: true,
            routeActiveStrokeColor: "#dc3545",
            routeActiveStrokeWidth: 5
        });
        this.currentRoute = multiRoute;
        AppState.myMap.geoObjects.add(multiRoute);
    },

    renderHarita: function(gorevListesi) {
        const myMap = AppState.myMap;
        myMap.geoObjects.each(go => {
            if (go !== this.userPlacemark && go !== this.currentRoute) {
                myMap.geoObjects.remove(go);
            }
        });
        AppState.tumPlacemarks = [];
        this.sonSecilenPlacemark = null;

        const collection = new ymaps.GeoObjectCollection(null, {});
        gorevListesi.forEach(gorev => {
            if (gorev.enlem && gorev.boylam) {
                const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], {
                    rowIndex: gorev.rowIndex,
                    mahalle: gorev.mahalle
                }, {
                    preset: 'islands#redDotIcon'
                });
                placemark.events.add('click', (e) => {
                    const targetPlacemark = e.get('target');
                    const rowIndex = targetPlacemark.properties.get('rowIndex');
                    const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
                    if (gorev && document.getElementById('mahalle-filtre').value !== gorev.mahalle) {
                        document.getElementById('mahalle-filtre').value = gorev.mahalle;
                        UI.filtrele();
                    }
                    // =========================================================================
                    // ==== YAZIM HATASI BURADA DÜZELTİLDİ ====
                    // =========================================================================
                    this.vurgulaPin(targetPlacemark); // Eksik olan parantez ')' eklendi.
                    // =========================================================================
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

    filtrele: function(secilenMahalle) {
        const boundsToShow = [];
        this.sonSecilenPlacemark = null;
        AppState.tumPlacemarks.forEach(placemark => {
            const pinMahalle = placemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                placemark.options.set('preset', 'islands#redDotIcon');
                placemark.options.set('opacity', 1);
                if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') {
                    boundsToShow.push(placemark.geometry.getCoordinates());
                }
            } else {
                placemark.options.set('preset', 'islands#yellowDotIcon');
                placemark.options.set('opacity', 0.6);
            }
        });
        if (boundsToShow.length > 0) {
            if (secilenMahalle === 'TUMU') {
                AppState.myMap.setBounds(ymaps.util.bounds.fromPoints(boundsToShow), { checkZoomRange: true, zoomMargin: 40 });
            } else {
                const center = ymaps.util.bounds.getCenter(ymaps.util.bounds.fromPoints(boundsToShow));
                AppState.myMap.setCenter(center, 15, { duration: 500 });
            }
        }
    },
    
    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 16, { duration: 500 });
            const placemarkToSelect = AppState.tumPlacemarks.find(p => p.properties.get('rowIndex') === rowIndex);
            if (placemarkToSelect) {
                this.vurgulaPin(placemarkToSelect);
            }
        }
    },
    
    vurgulaPin: function(secilenPlacemark) {
        const secilenMahalle = document.getElementById('mahalle-filtre').value;
        if (this.sonSecilenPlacemark) {
            const prevPinMahalle = this.sonSecilenPlacemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
                this.sonSecilenPlacemark.options.set('preset', 'islands#redDotIcon');
            } else {
                this.sonSecilenPlacemark.options.set('preset', 'islands#yellowDotIcon');
            }
        }
        secilenPlacemark.options.set('preset', 'VioletSouvenirsCircleIcon');
        this.sonSecilenPlacemark = secilenPlacemark;
    },

    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.container.fitToViewport();
        }
    }
};
