// =================================================================================
// == MODÜL: Harita Yönetimi (map.js)
// =================================================================================

const MapManager = {
    sonSecilenPlacemark: null, userPlacemark: null, currentUserLocation: null, currentRoute: null,

    initMap: function(elementId) {
        AppState.myMap = new ymaps.Map(elementId, { center: [39.7667, 30.5256], zoom: 12, controls: ['zoomControl'] }, { yandexMapAutoSwitch: true });
        AppState.myMap.events.add('click', () => { if (document.body.classList.contains('liste-odakli')) UI.toggleGorunum(); });
        this.startGeolocation();
    },

    startGeolocation: function() { ymaps.geolocation.get({ provider: 'browser', mapStateAutoApply: false }).then(result => { this.currentUserLocation = result.geoObjects.position; if (this.userPlacemark) AppState.myMap.geoObjects.remove(this.userPlacemark); this.userPlacemark = new ymaps.Placemark(this.currentUserLocation, {}, { preset: 'islands#geolocationIcon', zIndex: 999 }); AppState.myMap.geoObjects.add(this.userPlacemark); }, () => { console.warn("Konum izni alınamadı."); }); },
    drawRoute: function(destinationCoords) { if (!this.currentUserLocation) { alert("Konumunuz tespit edilemedi."); return; } if (this.currentRoute) AppState.myMap.geoObjects.remove(this.currentRoute); const multiRoute = new ymaps.multiRouter.MultiRoute({ referencePoints: [this.currentUserLocation, destinationCoords], params: { results: 1 } }, { boundsAutoApply: true, routeActiveStrokeColor: "#dc3545", routeActiveStrokeWidth: 5 }); this.currentRoute = multiRoute; AppState.myMap.geoObjects.add(multiRoute); },

    renderHarita: function(gorevListesi) {
        const myMap = AppState.myMap;
        myMap.geoObjects.each(go => { if (go !== this.userPlacemark && go !== this.currentRoute) myMap.geoObjects.remove(go); });
        AppState.tumPlacemarks = []; this.sonSecilenPlacemark = null;
        const collection = new ymaps.GeoObjectCollection(null, {});
        gorevListesi.forEach(gorev => {
            if (gorev.enlem && gorev.boylam) {
                const placemark = new ymaps.Placemark([gorev.enlem, gorev.boylam], { rowIndex: gorev.rowIndex, mahalle: gorev.mahalle }, { 
                    preset: 'islands#redCircleDotIcon' // DOĞRU İKON
                });
                placemark.events.add('click', (e) => {
                    const targetPlacemark = e.get('target');
                    const rowIndex = targetPlacemark.properties.get('rowIndex');
                    const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
                    if (gorev && document.getElementById('mahalle-filtre').value !== gorev.mahalle) {
                        document.getElementById('mahalle-filtre').value = gorev.mahalle;
                        UI.filtrele();
                    }
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

    filtrele: function(secilenMahalle) {
        const boundsToShow = []; this.sonSecilenPlacemark = null;
        AppState.tumPlacemarks.forEach(placemark => {
            const pinMahalle = placemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                placemark.options.set('preset', 'islands#redCircleDotIcon'); // DOĞRU İKON
                placemark.options.set('opacity', 1);
                if (pinMahalle === secilenMahalle || secilenMahalle === 'TUMU') boundsToShow.push(placemark.geometry.getCoordinates());
            } else {
                placemark.options.set('preset', 'islands#yellowCircleDotIcon'); // DOĞRU İKON
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
            AppState.myMap.setCenter([gorev.enlem, gorev.boylam], 17, { duration: 500 });
            const placemarkToSelect = AppState.tumPlacemarks.find(p => p.properties.get('rowIndex') === rowIndex);
            if (placemarkToSelect) this.vurgulaPin(placemarkToSelect);
        }
    },
    
    vurgulaPin: function(secilenPlacemark) {
        const secilenMahalle = document.getElementById('mahalle-filtre').value;
        if (this.sonSecilenPlacemark) {
            const prevPinMahalle = this.sonSecilenPlacemark.properties.get('mahalle');
            if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
                this.sonSecilenPlacemark.options.set('preset', 'islands#redCircleDotIcon'); // DOĞRU İKON
            } else {
                this.sonSecilenPlacemark.options.set('preset', 'islands#yellowCircleDotIcon'); // DOĞRU İKON
            }
        }
        secilenPlacemark.options.set('preset', 'islands#greenIcon');
        this.sonSecilenPlacemark = secilenPlacemark;
    },

    boyutlandir: function() { if (AppState.myMap) AppState.myMap.container.fitToViewport(); }
};
