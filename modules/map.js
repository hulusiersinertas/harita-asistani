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

    // Harita zaten varsa tekrar oluşturma
    if (!map) {
        // İlk açılış konumu hesapla (Bounds veya Merkez)
        const locationParams = calculateInitialLocation(gorevler);

        map = new YMap(document.getElementById('app'), {
            location: locationParams
        });
        
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer({}));
    }

    // Görevleri haritaya ekle
    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            addSingleMarker(gorev);
        }
    });

    console.log(`${placemarks.size} adet görev haritaya eklendi.`);
    return { map, placemarks };
}

export function addSingleMarker(gorev) {
    if (!map || !gorev.hasCoords) return null;

    const { YMapMarker } = ymaps3;
    const placemarkElement = createPlacemarkElement(gorev.id);
    
    // Yandex v3 Marker
    const marker = new YMapMarker(
        {
            coordinates: [gorev.boylam, gorev.enlem],
            zIndex: 10
        },
        placemarkElement
    );
    
    map.addChild(marker);
    
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

/**
 * Haritanın başlangıç konumunu hesaplar.
 * Eğer koordinat varsa "bounds" (sınırlar) döner, yoksa varsayılan Ankara döner.
 */
function calculateInitialLocation(gorevler) {
    let minLat = 90, maxLat = -90;
    let minLng = 180, maxLng = -180;
    let count = 0;

    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            if (gorev.enlem < minLat) minLat = gorev.enlem;
            if (gorev.enlem > maxLat) maxLat = gorev.enlem;
            if (gorev.boylam < minLng) minLng = gorev.boylam;
            if (gorev.boylam > maxLng) maxLng = gorev.boylam;
            count++;
        }
    });

    // Eğer hiç koordinat yoksa Ankara'yı aç
    if (count === 0) {
        return {
            center: [32.8597, 39.9334], // Ankara
            zoom: 12
        };
    }

    // Tek bir nokta varsa oraya zoom yap
    if (count === 1) {
        return {
            center: [minLng, minLat],
            zoom: 15
        };
    }

    // Birden fazla nokta varsa hepsini kapsayan alanı (Bounds) aç
    // Yandex bounds formatı: [[minLng, minLat], [maxLng, maxLat]]
    // Kenarlardan biraz boşluk bırakmak için zoom ile oynanabilir ama bounds en iyisidir.
    return {
        bounds: [
            [minLng, minLat], // Sol Alt
            [maxLng, maxLat]  // Sağ Üst
        ]
    };
}
