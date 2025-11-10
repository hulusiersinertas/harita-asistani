// Global değişkenler bu modül içinde saklanacak
let map;
const placemarks = new Map(); // Oluşturulan marker'ları saklamak için

/**
 * Yandex Haritasını başlatır, görevlerin merkezine odaklar ve pinleri ekler.
 * @param {Array} gorevler - İşlenmiş görev nesnelerinden oluşan dizi.
 */
export async function initMap(gorevler) {
    await ymaps3.ready;

    // --- DEĞİŞİKLİK: Varsayılan özellikleri ve UI'ı import ediyoruz ---
    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker,
        YMapControls, // Kontroller için (zoom vb.)
        YMapDefaultMarker // Varsayılan marker davranışı için
    } = ymaps3;

    // --- DEĞİŞİKLİK: Zoom kontrolünü import ediyoruz ---
    const {YMapZoomControl} = await ymaps3.import('@yandex/ymaps3-controls@0.0.1');

    const centerCoordinates = calculateCenter(gorevler);

    map = new YMap(document.getElementById('app'), {
        location: {
            center: centerCoordinates,
            zoom: 12
        }
    });

    // Standart harita katmanını ekle
    map.addChild(new YMapDefaultSchemeLayer());
    
    // --- YENİ ve KRİTİK ADIM: Varsayılan özellikleri haritaya ekliyoruz ---
    // Bu, marker gibi özelliklerin düzgün çalışması için gereklidir.
    map.addChild(new YMapDefaultFeaturesLayer({id: 'features'}));

    // Zoom kontrollerini ekleyelim (isteğe bağlı ama faydalı)
    const controls = new YMapControls({position: 'right'});
    controls.addChild(new YMapZoomControl({}));
    map.addChild(controls);


    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            const placemarkElement = createPlacemarkElement(gorev.id);
            
            // Not: Artık source özelliğine ihtiyacımız kalmadı, çünkü
            // varsayılan 'features' katmanını kullanıyoruz.
            const marker = new YMapMarker(
                {
                    coordinates: [gorev.boylam, gorev.enlem],
                },
                placemarkElement
            );
            
            map.addChild(marker);
            
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
