// Global değişkenler harita ve işaretçileri saklamak için
let map;
const gorevMarkers = [];

/**
 * Yandex Haritasını başlatır ve verilen görevleri haritada işaretçi olarak gösterir.
 * @param {Array} gorevler - Gösterilecek görev nesnelerinin dizisi.
 */
export async function initMap(gorevler) {
    // ymaps3 kütüphanesinin hazır olmasını bekle
    await ymaps3.ready;

    // Gerekli Yandex Maps modüllerini import et
    const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

    // Haritayı #app div'i içinde başlat
    map = new YMap(document.getElementById('app'), {
        location: {
            center: [32.8597, 39.9334], // Başlangıç merkezi: Ankara
            zoom: 11
        }
    });

    // Haritanın temel katmanını (sokaklar, binalar vb.) ekle
    map.addChild(new YMapDefaultSchemeLayer());
    // İşaretçi gibi özellikleri ekleyeceğimiz katmanı ekle
    map.addChild(new YMapDefaultFeaturesLayer());

    // Sadece koordinatı olan görevleri al
    const gorevlerWithCoords = gorevler.filter(g => g.hasCoords);

    // Her görev için bir işaretçi (marker) oluştur ve haritaya ekle
    gorevlerWithCoords.forEach(goreve => {
        const markerElement = createMarkerElement('red'); // Kırmızı pinler oluştur
        
        const marker = new YMapMarker(
            {
                coordinates: [goreve.boylam, goreve.enlem],
                // Bu custom özellikler, pine tıkladığımızda hangi göreve ait olduğunu bilmemizi sağlar
                properties: {
                    gorevId: goreve.id 
                }
            },
            markerElement
        );

        map.addChild(marker);
        gorevMarkers.push(marker); // Daha sonra erişebilmek için marker'ı diziye ekle
    });
    
    // Eğer haritada en az bir görev varsa, haritanın görünümünü tüm görevleri içerecek şekilde ayarla
    if (gorevlerWithCoords.length > 0) {
        // Tüm görevlerin koordinatlarını bir diziye topla
        const allCoordinates = gorevlerWithCoords.map(g => [g.boylam, g.enlem]);
        // Yandex'in `bounds` (sınırlar) özelliğini kullanarak haritayı tüm noktalara odakla
        map.setLocation({
            bounds: ymaps3.common.bounds.fromPoints(allCoordinates),
            padding: { top: 100, bottom: 150, left: 50, right: 50 } // Paneller için boşluk bırak
        });
    }

    console.log("Harita başarıyla başlatıldı ve pinler eklendi.");
}

/**
 * İşaretçiler için özel bir HTML elementi oluşturan yardımcı fonksiyon.
 * @param {string} color - Pin'in rengi.
 * @returns {HTMLElement}
 */
function createMarkerElement(color) {
    const element = document.createElement('div');
    element.style.width = '14px';
    element.style.height = '14px';
    element.style.backgroundColor = color;
    element.style.borderRadius = '50%';
    element.style.border = '2px solid white';
    element.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
    element.style.cursor = 'pointer';
    // Merkezi doğru ayarlamak için transform kullanıyoruz
    element.style.transform = 'translate(-50%, -50%)';
    return element;
}
