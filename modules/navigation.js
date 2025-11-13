// Harita kamerası, GPS takibi ve kullanıcı konumuyla ilgili tüm mantığı yönetir.

let mapInstance = null;
let userMarker = null;
let locationWatcherId = null;
let isNavigationModeActive = false;

// Harita döndürme değişkenleri
let rotationDirection = 0;
const ROTATION_SPEED = 0.2;
// DÜZELTME: Her zaman geçerli bir başlangıç değeri olan bir nesne olarak başlatıyoruz.
let currentCameraState = { tilt: 0, azimuth: 0 };

/**
 * Dışarıdan (ui.js'ten) gelen kamera güncellemelerini güvenli bir şekilde alır.
 * Bu, modülün hafızasının her zaman harita ile senkronize olmasını sağlar.
 * @param {object} newCamera - Haritanın yeni kamera durumu nesnesi.
 */
export function updateExternalCameraState(newCamera) {
    if (newCamera && typeof newCamera.azimuth !== 'undefined') {
        currentCameraState = newCamera;
    }
}

/**
 * Kullanıcının mevcut konumunu bir Promise olarak döndürür.
 */
export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve([position.coords.longitude, position.coords.latitude]),
            (error) => {
                let message = 'Konum bilgisi alınamadı.';
                if (error.code === error.PERMISSION_DENIED) message = 'Konum izni reddedildi.';
                reject(new Error(message));
            },
            { enableHighAccuracy: true }
        );
    });
}

/**
 * Haritanın manuel olarak döndürülmesi için animasyon döngüsünü başlatır.
 */
function animateRotation() {
    if (rotationDirection === 0 || isNavigationModeActive) return;

    // currentCameraState'in artık undefined olma riski yok.
    const newAzimuth = currentCameraState.azimuth + (rotationDirection * ROTATION_SPEED);
    const newCameraState = { ...currentCameraState, azimuth: newAzimuth };

    currentCameraState = newCameraState;

    mapInstance.update({ camera: newCameraState });
    requestAnimationFrame(animateRotation);
}

// ... Diğer fonksiyonlar (startNavigation, stopNavigation) aynı kalıyor ...

const startNavigation = () => {
    // ... Bu fonksiyonun içinde değişiklik yok ...
};
const stopNavigation = () => {
    // ... Bu fonksiyonun içinde değişiklik yok ...
};


/**
 * Navigasyon ve harita döndürme kontrollerini kurar.
 */
export function initNavigation(map) {
    mapInstance = map;

    // DÜZELTME: Hata veren `currentCameraState = map.camera;` satırı kaldırıldı.

    const rotateLeftBtn = document.getElementById('rotate-left');
    const rotateRightBtn = document.getElementById('rotate-right');
    const navigationBtn = document.getElementById('navigation-toggle-btn');

    const startRotation = (direction) => {
        if (isNavigationModeActive) return;
        if (rotationDirection === 0) {
            rotationDirection = direction;
            requestAnimationFrame(animateRotation);
        } else {
            rotationDirection = direction;
        }
    };
    const stopRotation = () => { rotationDirection = 0; };

    rotateLeftBtn.addEventListener('mousedown', () => startRotation(-1));
    rotateLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(-1); });
    rotateRightBtn.addEventListener('mousedown', () => startRotation(1));
    rotateRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(1); });
    document.addEventListener('mouseup', stopRotation);
    document.addEventListener('touchend', stopRotation);

    navigationBtn.addEventListener('click', () => {
        if (isNavigationModeActive) {
            stopNavigation();
        } else {
            startNavigation();
        }
    });
}
