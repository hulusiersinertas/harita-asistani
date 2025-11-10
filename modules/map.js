// =================================================================================
// == MODÜL: Harita Yönetimi (map.js) - NİHAİ DÜZELTİLMİŞ VERSİYON
// =================================================================================

const MapManager = {
    userMarker: null,
    sonSecilenMarker: null,
    
    initMap: async function(elementId) {
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener, YMapControls } = ymaps3;
        await ymaps3.import.registerCdn('https://cdn.jsdelivr.net/npm/{package}/dist/index.js', ['@yandex/ymaps3-default-ui-theme@0.0']);
        const { YMapZoomControl } = await ymaps3.import('@yandex/ymaps3-default-ui-theme');
        
        AppState.myMap = new YMap(document.getElementById(elementId), { location: AppConfig.MAP_DEFAULTS });
        AppState.myMap.addChild(new YMapDefaultSchemeLayer({}));
        AppState.myMap.addChild(new YMapDefaultFeaturesLayer({}));
        const controls = new YMapControls({position: 'right'});
        controls.addChild(new YMapZoomControl({}));
        AppState.myMap.addChild(controls);

        AppState.myMap.addChild(new YMapListener({
            onClick: () => { if (document.body.classList.contains('liste-odakli')) { UI.toggleGorunum(); } }
        }));
        this.startGeolocation(YMapMarker);
    },

    startGeolocation: function(YMapMarker) {
        if (!navigator.geolocation) { console.warn("Bu tarayıcı Geolocation'ı desteklemiyor."); return; }
        navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const userCoordinates = [longitude, latitude];
                if (!this.userMarker) {
                    const markerElement = document.createElement('div');
                    markerElement.className = 'user-marker';
                    this.userMarker = new YMapMarker({ coordinates: userCoordinates, zIndex: 9999 }, markerElement);
                    AppState.myMap.addChild(this.userMarker);
                    console.log("Kullanıcı konumu haritaya eklendi.");
                } else { this.userMarker.update({ coordinates: userCoordinates }); }
            },
            () => { console.warn("Konum izni alınamadı veya konum bulunamadı."); },
            { enableHighAccuracy: true }
        );
    },
    
    renderHarita: function(gorevListesi) {
        const { YMapMarker, YMapListener } = ymaps3;
        AppState.gorevMarkers.forEach(marker => AppState.myMap.removeChild(marker));
        AppState.gorevMarkers = [];
        this.sonSecilenMarker = null;

        gorevListesi.forEach(gorev => {
            if (gorev.coordinates) {
                const markerElement = document.createElement('div');
                markerElement.className = 'gorev-marker';
                const marker = new YMapMarker({
                    coordinates: gorev.coordinates,
                    properties: { rowIndex: gorev.rowIndex, mahalle: gorev.mahalle },
                    zIndex: 100
                }, markerElement);
                marker.addChild(new YMapListener({ onClick: () => this.onMarkerClick(marker) }));
                AppState.gorevMarkers.push(marker);
                AppState.myMap.addChild(marker);
            }
        });
    },

    onMarkerClick: function(marker) {
        const rowIndex = marker.properties.rowIndex;
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && document.getElementById('mahalle-filtre').value !== gorev.mahalle) {
            document.getElementById('mahalle-filtre').value = gorev.mahalle;
            UI.filtrele();
        }
        this.vurgulaPin(marker);
        UI.renderDetayPaneli(rowIndex);
        UI.vurgula(rowIndex);
    },

    drawRoute: function(destinationCoords) {
        alert("Rota çizme özelliği, Haritalar API v3'te henüz doğrudan desteklenmemektedir.");
    },

    filtrele: function(secilenMahalle) {
        let visibleMarkerCoordinates = [];
        this.sonSecilenMarker = null;

        AppState.gorevMarkers.forEach(marker => {
            const pinMahalle = marker.properties.mahalle;
            const markerElement = marker.element;
            if (secilenMahalle === 'TUMU' || pinMahalle === secilenMahalle) {
                markerElement.className = 'gorev-marker';
                markerElement.style.opacity = '1';
                visibleMarkerCoordinates.push(marker.coordinates);
            } else {
                markerElement.className = 'gorev-marker filtered-out';
                markerElement.style.opacity = '0.5';
            }
        });

        if (visibleMarkerCoordinates.length > 0) {
            // v3'te 'bounds' özelliğinin daha stabil çalışması için bu yapıyı kullanıyoruz.
            // Bu, haritayı verilen tüm noktaları içerecek şekilde ayarlar.
             AppState.myMap.update({
                location: {
                    bounds: visibleMarkerCoordinates,
                    duration: 500
                }
            });
        }
    },

    odaklan: function(rowIndex) {
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.coordinates) {
            AppState.myMap.update({
                location: { center: gorev.coordinates, zoom: 17, duration: 500 }
            });
            const markerToSelect = AppState.gorevMarkers.find(m => m.properties.rowIndex === rowIndex);
            if (markerToSelect) {
                this.vurgulaPin(markerToSelect);
            }
        }
    },

    vurgulaPin: function(secilenMarker) {
        if (this.sonSecilenMarker && this.sonSecilenMarker.element) {
            const prevPinMahalle = this.sonSecilenMarker.properties.mahalle;
            const secilenMahalle = document.getElementById('mahalle-filtre').value;
            if (secilenMahalle === 'TUMU' || prevPinMahalle === secilenMahalle) {
                this.sonSecilenMarker.element.className = 'gorev-marker';
            } else {
                this.sonSecilenMarker.element.className = 'gorev-marker filtered-out';
            }
        }
        if (secilenMarker && secilenMarker.element) {
            secilenMarker.element.className = 'gorev-marker selected';
        }
        this.sonSecilenMarker = secilenMarker;
    },

    boyutlandir: function() {
        if (AppState.myMap) {
            AppState.myMap.update({ location: { ...AppState.myMap.location } });
        }
    }
};
