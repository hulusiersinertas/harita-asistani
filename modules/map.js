// Global değişkenler bu modül içinde saklanacak
let map;
const placemarks = new Map(); // Oluşturulan marker'ları saklamak için

/**
 * Yandex Haritasını başlatır ve görev noktalarını (pinleri) ekler.
 * @param {Array} gorevler - İşlenmiş görev nesnelerinden oluşan dizi.
 */
export async function initMap(gorevler) {
    // ymaps3 kütüphanesi hazır olana kadar bekle
    await ymaps3.ready;

    // Gerekli Yandex Maps modüllerini import et
    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker
    } = ymaps3;

    // Haritayı #app div'i içinde başlat
    map = new YMap(
        document.getElementById('app'),
        {
            location: {
                center: [32.8597, 39.9334], // Başlangıç merkezi: Ankara
                zoom: 11
            }
        }
    );

    // Harita katmanlarını ekle
    map.addChild(new YMapDefaultSchemeLayer()); // Standart harita görünümü

    // --- DEĞİŞİKLİK BAŞLANGIÇ ---
    // Marker gibi özellikleri ekleyeceğimiz katmanı bir değişkende saklıyoruz.
    const featuresLayer = new YMapDefaultFeaturesLayer();
    map.addChild(featuresLayer);
    // --- DEĞİŞİKLİK SON ---

    // Koordinatı olan her görev için bir marker oluştur ve haritaya ekle
    gorevler.forEach(gorev => {
        if (gorev.hasCoords) {
            const placemarkElement = createPlacemarkElement(gorev.id);
            
            const marker = new YMapMarker(
                {
                    coordinates: [gorev.boylam, gorev.enlem], // [longitude, latitude]
                    zIndex: 10
                },
                placemarkElement
            );

            // --- DEĞİŞİKLİK ---
            // Marker'ı doğrudan haritaya değil, özellik katmanına ekliyoruz.
            featuresLayer.addChild(marker);

            placemarks.set(gorev.id, { marker, element: placemarkElement }); // Marker'ı ve elementini sakla
        }
    });

    console.log(`${placemarks.size} adet görev haritaya eklendi.`);
    
    // Uygulamanın diğer bölümlerinin haritaya erişebilmesi için map nesnesini döndür
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
    // Tıklama olaylarını yönetebilmek için görevin ID'sini element üzerinde saklıyoruz.
    element.dataset.id = gorevId;
    return element;
}
