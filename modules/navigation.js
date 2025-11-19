// Harita kamerası, GPS takibi ve kullanıcı konumuyla ilgili tüm mantığı yönetir.

let mapInstance = null;
let userMarker = null;
let locationWatcherId = null;
let isNavigationModeActive = false;

// YENİ EKLENDİ: Navigasyon modundayken en son bilinen konumu saklamak için.
let lastKnownLocation = null;

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
    // GÜNCELLENDİ: Eğer navigasyon modu aktifse ve bir konumumuz varsa,
    // yeni bir istek atmak yerine direkt onu kullanıyoruz. Bu, zaman aşımını engeller.
    if (isNavigationModeActive && lastKnownLocation) {
        return Promise.resolve(lastKnownLocation);
    }
    
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('Tarayıcınız konum servisini desteklemiyor.'));
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve([position.coords.longitude, position.coords.latitude]),
            (error) => {
                let message = 'Bilinmeyen bir hata nedeniyle konum alınamadı.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Konum bilgisine ulaşılamıyor. Cihazınızın konum servislerinin açık olduğundan emin olun.';
                        break;
                    case error.TIMEOUT:
                        message = 'Konum alımı zaman aşımına uğradı. Lütfen sinyalin daha iyi olduğu bir yerde tekrar deneyin.';
                        break;
                }
                reject(new Error(message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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

export const startNavigation = () => {
    if (!navigator.geolocation) {
        alert("Tarayıcınız konum servisini desteklemiyor.");
        return;
    }
    if (locationWatcherId !== null) return;

    isNavigationModeActive = true;
    document.getElementById('navigation-toggle-btn').classList.add('active');
    if (rotateLeftBtn) rotateLeftBtn.disabled = true;
    if (rotateRightBtn) rotateRightBtn.disabled = true;

    locationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            const { longitude, latitude, heading } = position.coords;
            const userCoordinates = [longitude, latitude];

            // YENİ EKLENDİ: En son konumu her geldiğinde saklıyoruz.
            lastKnownLocation = userCoordinates;

            if (!userMarker) {
                const markerElement = document.createElement('div');
                markerElement.className = 'user-marker';
                userMarker = new ymaps3.YMapMarker({ coordinates: userCoordinates }, markerElement);
                mapInstance.addChild(userMarker);
            } else {
                userMarker.update({ coordinates: userCoordinates });
            }
            
            const cameraUpdate = {
                tilt: 60,
                azimuth: heading ?? currentCameraState.azimuth,
                duration: 400
            };

            mapInstance.update({
                location: { center: userCoordinates, zoom: 18, duration: 400 },
                camera: cameraUpdate
            });
        },
        (error) => {
            alert("Konum izlenirken bir hata oluştu. Lütfen konum servislerini kontrol edin.");
            console.error("Konum izleme hatası:", error);
            stopNavigation();
        },
        { enableHighAccuracy: true }
    );
};

export const stopNavigation = () => {
    if (locationWatcherId !== null) {
        navigator.geolocation.clearWatch(locationWatcherId);
        locationWatcherId = null;
    }
    isNavigationModeActive = false;
    // YENİ EKLENDİ: Navigasyon durunca son konumu temizle.
    lastKnownLocation = null;
    document.getElementById('navigation-toggle-btn').classList.remove('active');
    if (rotateLeftBtn) rotateLeftBtn.disabled = false;
    if (rotateRightBtn) rotateRightBtn.disabled = false;
    
    mapInstance.update({
        camera: { tilt: 0, duration: 500 }
    });
};

/**
 * Navigasyon ve harita döndürme kontrollerini kurar.
 */
export function initNavigation(map) {
    mapInstance = map;

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
