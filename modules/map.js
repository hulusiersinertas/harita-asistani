// Global değişkenler bu modül içinde saklanacak
let map;
const placemarks = new Map(); // Oluşturulan marker'ları saklamak için

/**
 * Yandex Haritasını başlatır, görevlerin merkezine odaklar ve pinleri ekler.
 * @param {Array} gorevler - İşlenmiş görev nesnelerinden oluşan dizi.
 */
export async function initMap(gorevler) {
    await ymaps3.ready;

    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker
    } = ymaps3;

    const centerCoordinates = calculateCenter(gorevler);

    map = new YMap(document.getElementById('app'), {
        location: {
            center: centerCoordinates,
            zoom: 12
        }
    });

    // 1. Haritanın zeminini (yollar, binalar) ekliyoruz. Bu standart bir adım.
    map.addChild(new YMapDefaultSchemeLayer());

    // 2. EN ÖNEMLİ ADIM: İşaretçi (marker) gibi "özellikleri" çizecek olan
    // standart katmanı haritaya ekliyoruz. Bu katman olmadan marker'lar render edilemez.
    map.addChild(new YMapDefaultFeaturesLayer({}));


    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            const placemarkElement = createPlacemarkElement(gorev.id);
            
            const marker = new YMapMarker(
                {
                    // Sadece en temel özellik olan koordinatları veriyoruz.
                    coordinates: [gorev.boylam, gorev.enlem]
                },
                placemarkElement
            );
            
            // 3. İşaretçiyi, özellik katmanına değil, doğrudan haritanın kendisine ekliyoruz.
            // API, bu marker'ı otomatik olarak YMapDefaultFeaturesLayer üzerinde çizeceğini anlar.
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
