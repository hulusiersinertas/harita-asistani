// DOSYA YOLU: modules/navigation.js

// Harita kamerası, GPS takibi ve kullanıcı konumuyla ilgili tüm mantığı yönetir.

let mapInstance = null;
let userMarker = null;
let locationWatcherId = null;
let isNavigationModeActive = false;

// YENİ EKLENDİ: Navigasyon modundayken en son bilinen konumu saklamak için.
let lastKnownLocation = null;

// AYARLAR (Tuning)
const MIN_SPEED_FOR_ROTATION = 1.5; // m/s (Yaklaşık 5.4 km/s altındaki hızlarda haritayı döndürme)
const MAX_ZOOM = 18; // Dururken veya yavaşken kullanılacak zoom
const MIN_ZOOM = 16; // Yüksek hızda düşülecek en az zoom seviyesi

// Harita döndürme değişkenleri
let rotationDirection = 0;
const ROTATION_SPEED = 0.2;
let currentCameraState = { tilt: 0, azimuth: 0 };

// Manuel kontrol butonları
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
    // Eğer navigasyon modu aktifse ve elimizde zaten güncel bir konum varsa onu kullan
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
                        message = 'Konum alımı zaman aşımına uğradı.';
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
    
    // Navigasyon modunda manuel döndürme butonlarını devre dışı bırak
    if (rotateLeftBtn) rotateLeftBtn.disabled = true;
    if (rotateRightBtn) rotateRightBtn.disabled = true;

    locationWatcherId = navigator.geolocation.watchPosition(
        (position) => {
            const { longitude, latitude, heading, speed } = position.coords;
            const userCoordinates = [longitude, latitude];

            // En son konumu sakla
            lastKnownLocation = userCoordinates;

            // 1. Marker Oluşturma veya Güncelleme
            if (!userMarker) {
                // Kapsayıcı (0x0 boyutunda)
                const markerContainer = document.createElement('div');
                markerContainer.className = 'user-marker-container';
                
                // Görselin olduğu Ok (44x44 boyutunda)
                const markerArrow = document.createElement('div');
                markerArrow.className = 'user-marker'; 
                
                // Oku kapsayıcının içine koyuyoruz
                markerContainer.appendChild(markerArrow);

                // Yandex Marker'a kapsayıcıyı veriyoruz
                userMarker = new ymaps3.YMapMarker({ 
                    coordinates: userCoordinates,
                    zIndex: 2000 // API tarafında da z-index verelim
                }, markerContainer);
                
                mapInstance.addChild(userMarker);
                console.log("Kullanıcı imleci haritaya eklendi."); // Konsoldan kontrol et
            } else {
                userMarker.update({ coordinates: userCoordinates });
            }

            // 2. Marker'ın Kendi Dönüşü (Haritadan Bağımsız)
            // Harita dönmese bile ikonumuz her zaman gidilen yöne baksın.
            const markerArrowElement = userMarker.element.querySelector('.user-marker');
            if (markerArrowElement && heading !== null && !isNaN(heading)) {
                markerArrowElement.style.transform = `rotate(${heading}deg)`;
                // Geçişin yumuşak olması için CSS'de transition tanımlı olmalı
                markerArrowElement.style.transition = 'transform 0.3s ease';
            }
            
            // 3. Akıllı Kamera Mantığı (Pervane Sorunu Çözümü)
            let targetAzimuth = currentCameraState.azimuth; // Varsayılan: Mevcut açıyı koru
            
            // Eğer hız yeterliyse (yaklaşık 5km/s üstü) VE heading bilgisi varsa haritayı döndür
            if (speed !== null && speed > MIN_SPEED_FOR_ROTATION && heading !== null && !isNaN(heading)) {
                targetAzimuth = heading;
            }

            // 4. Dinamik Zoom (Hıza Göre)
            // 0 km/s -> Zoom 18
            // 90 km/s (25m/s) -> Zoom 16
            let targetZoom = MAX_ZOOM;
            if (speed !== null && speed > 0) {
                const speedFactor = Math.min(speed / 25, 1); // 25 m/s üst limit
                targetZoom = MAX_ZOOM - (speedFactor * (MAX_ZOOM - MIN_ZOOM));
            }

            // Kamerayı güncelle
            // duration: 1000 yaparak GPS güncellemeleri arasındaki hareketi akıcı hale getiriyoruz
            mapInstance.update({
                location: { center: userCoordinates, zoom: targetZoom, duration: 1000 },
                camera: {
                    tilt: 60, // Navigasyon eğimi
                    azimuth: targetAzimuth,
                    duration: 1000
                }
            });
            
            // State'i güncelle ki manuel moda geçilirse saçmalamasın
            currentCameraState = { tilt: 60, azimuth: targetAzimuth };
        },
        (error) => {
            console.error("Konum izleme hatası:", error);
            alert("GPS sinyali alınamıyor veya izleme hatası oluştu.");
            stopNavigation();
        },
        { 
            enableHighAccuracy: true, // GPS'i zorla
            timeout: 10000,           // Veri gelmezse bekleme süresi
            maximumAge: 0             // Önbellekten eski veri kullanma
        }
    );
};

export const stopNavigation = () => {
    if (locationWatcherId !== null) {
        navigator.geolocation.clearWatch(locationWatcherId);
        locationWatcherId = null;
    }
    isNavigationModeActive = false;
    lastKnownLocation = null; // Son konumu temizle (isteğe bağlı)
    
    document.getElementById('navigation-toggle-btn').classList.remove('active');
    if (rotateLeftBtn) rotateLeftBtn.disabled = false;
    if (rotateRightBtn) rotateRightBtn.disabled = false;
    
    // Navigasyon bitince haritayı düzelt (Kuş bakışı)
    mapInstance.update({
        camera: { tilt: 0, azimuth: 0, duration: 800 },
        location: { zoom: 16, duration: 800 } // Standart zooma dön
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

    if(rotateLeftBtn) {
        rotateLeftBtn.addEventListener('mousedown', () => startRotation(-1));
        rotateLeftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(-1); });
    }
    
    if(rotateRightBtn) {
        rotateRightBtn.addEventListener('mousedown', () => startRotation(1));
        rotateRightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRotation(1); });
    }
    
    document.addEventListener('mouseup', stopRotation);
    document.addEventListener('touchend', stopRotation);

    if(navigationBtn) {
        navigationBtn.addEventListener('click', () => {
            if (isNavigationModeActive) {
                stopNavigation();
            } else {
                startNavigation();
            }
        });
    }
}

