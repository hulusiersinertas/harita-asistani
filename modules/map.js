// Global değişkenler bu modül içinde saklanacak
let map;
const placemarks = new Map(); // Oluşturulan marker'ları saklamak için

/**
 * Yandex Haritasını başlatır, görevlerin merkezine odaklar ve pinleri ekler.
 * @param {Array} gorevler - İşlenmiş görev nesnelerinden oluşan dizi.
 */
export async function initMap(gorevler) {
    await ymaps3.ready;

    // --- DEĞİŞİKLİK: YMapFeatureDataSource modülünü de import ediyoruz ---
    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker,
        YMapFeatureDataSource // Yeni eklenen modül
    } = ymaps3;

    const centerCoordinates = calculateCenter(gorevler);

    map = new YMap(document.getElementById('app'), {
        location: {
            center: centerCoordinates,
            zoom: 12
        }
    });

    map.addChild(new YMapDefaultSchemeLayer());

    // --- DEĞİŞİKLİK ADIM 1: Marker'larımız için bir veri kaynağı oluşturuyoruz ---
    // Bu kaynağa 'myMarkers' adını veriyoruz.
    const markerSource = new YMapFeatureDataSource({
        id: 'myMarkers'
    });
    map.addChild(markerSource);

    // --- DEĞİŞİKLİK ADIM 2: Katmana hangi kaynaktan veri çizeceğini söylüyoruz ---
    // Diyoruz ki: "Sen, 'myMarkers' kaynağından gelen özellikleri çiz."
    const featuresLayer = new YMapDefaultFeaturesLayer({
        source: 'myMarkers'
    });
    map.addChild(featuresLayer);


    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            const placemarkElement = createPlacemarkElement(gorev.id);
            
            const marker = new YMapMarker(
                {
                    // --- DEĞİŞİKLİK ADIM 3: Her marker'a hangi kaynağa ait olduğunu söylüyoruz ---
                    source: 'myMarkers', // Bu marker 'myMarkers' kaynağına aittir.
                    coordinates: [gorev.boylam, gorev.enlem],
                    zIndex: 10 // zIndex artık çalışacaktır çünkü marker render ediliyor.
                },
                placemarkElement
            );
            
            // Marker'ları artık doğrudan katmana değil, veri kaynağına ekliyoruz.
            // Katman, kaynaktaki değişiklikleri otomatik olarak algılayıp çizecektir.
            markerSource.add(marker);
            
            placemarks.set(gorev.id, { marker, element: placemarkElement });
        }
    });

    console.log(`${placemarks.size} adet görev haritaya eklendi.`);
    return { map, placemarks };
}

/**
 * Her bir görev için tıklanabilir bir HTML elementi oluşturur.
 * @param {number} gorevId - Görevin benzersiz kimliği.
 * @returns {HTMLElement}
 */
function createPlacemarkElement(gorevId) {
    const element = document.createElement('div');
    element.className = 'placemark';
    element.dataset.id = gorevId;
    return element;
}

/**
 * Verilen görev listesindeki koordinatların aritmetik ortalamasını (merkezini) bulur.
 * @param {Array} gorevler - Görev nesneleri dizisi.
 * @returns {[number, number]} - [ortalama_boylam, ortalama_enlem]
 */
function calculateCenter(gorevler) {
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            totalLat += gorev.enlem;
            totalLng += gorev.boylam;
            count++;
        }
    });

    if (count > 0) {
        return [totalLng / count, totalLat / count];
    }
    return [32.8597, 39.9334];
}
