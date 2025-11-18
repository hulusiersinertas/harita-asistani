// Harita kamerası, GPS takibi ve kullanıcı konumuyla ilgili tüm mantığı yönetir.

let mapInstance = null;
let userMarker = null;
let locationWatcherId = null;
let isNavigationModeActive = false;

// Harita döndürme değişkenleri
let rotationDirection = 0;
const ROTATION_SPEED = 0.2;
let currentCameraState = { tilt: 0, azimuth: 0 }; // Başlangıç durumu
let onCameraUpdateCallback = () => {};

/**
 * Kullanıcının mevcut konumunu bir Promise olarak döndürür.
 * @returns {Promise<[number, number]>} [boylam, enlem]
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
    const newAzimuth = currentCameraState.azimuth + (rotationDirection * ROTATION_SPEED);
    const newCameraState = { ...currentCameraState, azimuth: newAzimuth };
    mapInstance.update({ camera: newCameraState });
    onCameraUpdateCallback(newCameraState); // Kamera durumunu ana UI modülüne bildir
    requestAnimationFrame(animateRotation);
}

const startNavigation = () => {
    if (!navigator.geolocation) {
        alert("Tarayıcınız konumu desteklemiyor.");
        return;
    }
    const navigationBtn = document.getElementById('navigation-toggle-btn');

    locationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, heading } = position.coords;
            const userCoordinates = [longitude, latitude];
            const { YMapMarker } = ymaps3;

            if (!userMarker) {
                const markerElement = document.createElement('div');
                markerElement.className = 'user-marker';
                userMarker = new YMapMarker({ coordinates: userCoordinates, zIndex: 10 }, markerElement);
                mapInstance.addChild(userMarker);
            } else {
                userMarker.update({ coordinates: userCoordinates });
            }

            let newCameraState = { ...currentCameraState };
            if (heading !== null && heading >= 0) {
                newCameraState.azimuth = heading;
            }
            onCameraUpdateCallback(newCameraState);

            mapInstance.update({ location: { center: userCoordinates, zoom: 17, duration: 1000 } });
        },
        (error) => {
            console.error("Konum izleme hatası:", error);
            alert("Konum izlenirken bir hata oluştu. Mod durduruluyor.");
            stopNavigation();
        },
        { enableHighAccuracy: true }
    );

    isNavigationModeActive = true;
    navigationBtn.classList.add('active');
    navigationBtn.innerHTML = '🧭';
};

const stopNavigation = () => {
    if (locationWatcherId) navigator.geolocation.clearWatch(locationWatcherId);
    isNavigationModeActive = false;
    const navigationBtn = document.getElementById('navigation-toggle-btn');
    navigationBtn.classList.remove('active');
    navigationBtn.innerHTML = '🛰️';
};

/**
 * Navigasyon ve harita döndürme kontrollerini kurar.
 * @param {ymaps3.YMap} map - Harita nesnesi.
 * @param {function} onCameraUpdate - Kamera durumu değiştiğinde çağrılacak callback.
 */
export function initNavigation(map, onCameraUpdate) {
    mapInstance = map;
    onCameraUpdateCallback = onCameraUpdate;

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

/**
 * Navigasyon modunun aktif olup olmadığını döndürür.
 * @returns {boolean}
 */
export function isNavigating() {
    return isNavigationModeActive;
}

/**
 * Aktif navigasyon sırasında bir hedef belirlendiğinde rota çizimini tetikler.
 */
export function triggerRouteForNavigation() {
    // Bu fonksiyon şimdilik boş, ana ui.js tarafından yönetilecek
    // Gelecekte bir event emitter sistemiyle daha da soyutlanabilir.
}