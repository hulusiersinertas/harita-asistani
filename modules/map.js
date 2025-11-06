// =================================================================================
// == MODÜL: Harita Yönetimi (map.js) - YANDEX API v3.0 İÇİN GÜNCELLENDİ
// =================================================================================

const MapManager = {
    sonSecilenPlacemark: null,
    userPlacemark: null,
    currentUserLocation: null,
    currentRoute: null,

    // initMap fonksiyonunu async olarak işaretliyoruz
    initMap: async function(elementId) {
        try {
            // script.js'te ymaps3.ready kontrolü yapıldığı için burada tekrar gerek yok.
            const {YMap, YMapDefaultSchemeLayer, YMapControls} = ymaps3;
            const {YMapRotateControl} = await ymaps3.import('@yandex/ymaps3-default-ui-theme');
            
            AppState.myMap = new YMap(document.getElementById(elementId), {
                location: {
                    center: [30.5256, 39.7667], // Önce Boylam, sonra Enlem
                    zoom: 12,
                    azimuth: 0,
                    tilt: 0
                },
                behaviors: ['drag', 'pinchZoom', 'mouseRotate', 'scrollZoom']
            });

            AppState.myMap.addChild(new YMapDefaultSchemeLayer());
            AppState.myMap.addChild(
                new YMapControls({position: 'right'}, [
                    new YMapRotateControl({})
                ])
            );
            console.log("MapManager.initMap başarıyla tamamlandı.");
        } catch (error) {
            console.error("MapManager.initMap hatası:", error);
            throw error;
        }
    },

    // --- DİĞER FONKSİYONLAR v3.0'a GÖRE GÜNCELLENMELİ ---
    // Şimdilik bu fonksiyonları boş veya basitleştirilmiş halde bırakıyoruz
    // ki uygulama çökmesin.

    renderHarita: function(gorevListesi) {
        if (!AppState.myMap) return;
        console.log("renderHarita çağrıldı, ancak v3.0 için güncellenmeli. Pinler eklenmeyecek.");
        // Örnek: Pin ekleme mantığı tamamen değişti. 
        // Eski pinleri temizle (v3'te bu farklı yapılacak)
        // gorevListesi.forEach(gorev => { ... new YMapMarker(...) ... map.addChild(...) })
    },

    filtrele: function(secilenMahalle) {
        console.log(`Filtreleme: ${secilenMahalle}. Bu fonksiyon v3.0 için güncellenmeli.`);
    },
    
    odaklan: function(rowIndex) {
        if (!AppState.myMap) return;
        const gorev = AppState.tumGorevler.find(g => g.rowIndex === rowIndex);
        if (gorev && gorev.enlem && gorev.boylam) {
            // v3'te odaklanma komutu
            AppState.myMap.setLocation({
                center: [gorev.boylam, gorev.enlem], // Önce Boylam, sonra Enlem
                zoom: 16,
                duration: 500
            });
        }
    },
    
    // Bu fonksiyonlar şimdilik boş bırakıldı.
    startGeolocation: function() { console.log("startGeolocation v3.0 için güncellenmeli."); },
    drawRoute: function(destinationCoords) { console.log("drawRoute v3.0 için güncellenmeli."); },
    vurgulaPin: function(secilenPlacemark) { console.log("vurgulaPin v3.0 için güncellenmeli."); },
    boyutlandir: function() { if (AppState.myMap) AppState.myMap.update(); }
};
