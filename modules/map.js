// Global değişkenler
let map;
const placemarks = new Map(); 

export async function initMap(gorevler) {
    await ymaps3.ready;

    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker
    } = ymaps3;

    const centerCoordinates = calculateCenter(gorevler);

    // Harita zaten varsa tekrar oluşturma (Hata önleyici)
    if (!map) {
        map = new YMap(document.getElementById('app'), {
            location: {
                center: centerCoordinates,
                zoom: 12
            }
        });
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer({}));
    }

    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            addSingleMarker(gorev); // Kod tekrarını önlemek için burayı da güncelledik
        }
    });

    console.log(`${placemarks.size} adet görev haritaya eklendi.`);
    return { map, placemarks };
}

/**
 * Haritaya tek bir marker ekler ve referansını döner.
 * (Geri alma işlemi için gereklidir)
 */
export function addSingleMarker(gorev) {
    if (!map || !gorev.hasCoords) return null;

    const { YMapMarker } = ymaps3;
    const placemarkElement = createPlacemarkElement(gorev.id);
    
    const marker = new YMapMarker(
        {
            coordinates: [gorev.boylam, gorev.enlem],
            zIndex: 10 // Varsayılan z-index
        },
        placemarkElement
    );
    
    map.addChild(marker);
    
    // Map'e kaydet
    const pinData = { marker, element: placemarkElement };
    placemarks.set(gorev.id, pinData);
    
    return pinData;
}

function createPlacemarkElement(gorevId) {
    const element = document.createElement('div');
    element.className = 'placemark';
    element.dataset.id = gorevId;
    return element;
}

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
