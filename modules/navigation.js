// Harita kamerası, GPS takibi ve kullanıcı konumuyla ilgili tüm mantığı yönetir.

let mapInstance = null;
let userMarker = null;
let locationWatcherId = null;
let isNavigationModeActive = false;

// Harita döndürme değişkenleri
let rotationDirection = 0;
const ROTATION_SPEED = 0.2;
let currentCameraState = { tilt: 0, azimuth: 0 };

// Manuel kontrol butonları (daha sonra erişmek için)
let rotateLeftBtn, rotateRightBtn;

/**
 * Dışarıdan (ui.js'ten) gelen kamera güncellemelerini güvenli bir şekilde alır.
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
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

    currentCameraState = newCameraState;

    mapInstance.update({ camera: newCameraState });
    requestAnimationFrame(animateRotation);
}

// GÜNCELLENDİ: Navigasyon başlatma fonksiyonu
const startNavigation = () => {
    if (!navigator.geolocation) {
        alert("Tarayıcınız konum servisini desteklemiyor.");
        return;
    }

    isNavigationModeActive = true;
    document.getElementById('navigation-toggle-btn').classList.add('active');
    rotateLeftBtn.disabled = true;
    rotateRightBtn.disabled = true;

    locationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            const { longitude, latitude, heading } = position.coords;
            const userCoordinates = [longitude, latitude];

            // Kullanıcı işaretçisi yoksa oluştur, varsa güncelle
            if (!userMarker) {
                const markerElement = document.createElement('div');
                markerElement.className = 'user-marker';
                userMarker = new ymaps3.YMapMarker({ coordinates: userCoordinates }, markerElement);
                mapInstance.addChild(userMarker);
            } else {
                userMarker.update({ coordinates: userCoordinates });
            }

            // Harita kamerasını kullanıcıyı takip edecek şekilde güncelle
            // Heading (gidilen yön) null değilse haritayı o yöne döndür
            const cameraUpdate = {
                tilt: 60, // 3D görünüm için eğim
                azimuth: heading ?? currentCameraState.azimuth, // Gidilen yön veya mevcut açı
                duration: 400 // Yumuşak geçiş
            };

            mapInstance.update({
                location: { center: userCoordinates, zoom: 18, duration: 400 },
                camera: cameraUpdate
            });
        },
        (error) => {
            alert("Konum bilgisi alınamadı. Lütfen konum servislerinin açık olduğundan emin olun.");
            console.error("Konum izleme hatası:", error);
            stopNavigation(); // Hata durumunda navigasyonu durdur
        },
        { enableHighAccuracy: true }
    );
};

// GÜNCELLENDİ: Navigasyon durdurma fonksiyonu
const stopNavigation = () => {
    if (locationWatcherId !== null) {
        navigator.geolocation.clearWatch(locationWatcherId);
        locationWatcherId = null;
    }
    isNavigationModeActive = false;
    document.getElementById('navigation-toggle-btn').classList.remove('active');
    rotateLeftBtn.disabled = false;
    rotateRightBtn.disabled = false;

    // Haritayı normal görünüme geri döndür
    mapInstance.update({
        camera: { tilt: 0, duration: 500 }
    });
};

/**
 * Navigasyon ve harita döndürme kontrollerini kurar.
 */
export function initNavigation(map) {
    mapInstance = map;

    // Butonları global değişkenlere ata
    rotateLeftBtn = document.getElementById('rotate-left');
    rotateRightBtn = document.getElementById('rotate-right');
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
