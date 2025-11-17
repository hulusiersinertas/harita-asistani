import { config } from './config.js';
import { getUserLocation } from './navigation.js';

let currentRouteFeature = null;
let mapInstance = null;

/**
 * Rota çizim modülünü başlatır.
 */
export function initRouting(map) {
    mapInstance = map;
}

/**
 * OpenRouteService'in şifrelenmiş polyline formatını koordinat dizisine çözer.
 */
function decodePolyline(encoded) {
    let points = [], index = 0, len = encoded.length, lat = 0, lng = 0;
    while (index < len) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;
        points.push([lng / 1e5, lat / 1e5]);
    }
    return points;
}

/**
 * Haritadaki mevcut rotayı temizler.
 */
export function clearCurrentRoute() {
    if (currentRouteFeature) {
        mapInstance.removeChild(currentRouteFeature);
        currentRouteFeature = null;
    }
}

/**
 * Kullanıcının mevcut konumundan belirtilen göreve bir rota çizer.
 */
export async function drawRouteToTask(gorev, clickedButton) {
    let originalText = '';
    if (clickedButton) {
        originalText = clickedButton.textContent;
        clickedButton.textContent = 'Hesaplanıyor...';
        clickedButton.disabled = true;
    }

    clearCurrentRoute();

    try {
        // 1. Koordinatları al ve doğrula
        const startPoint = await getUserLocation();
        const endPoint = [gorev.boylam, gorev.enlem];

        if (!startPoint || !Array.isArray(startPoint) || startPoint.length !== 2) {
            throw new Error('Geçerli bir başlangıç konumu alınamadı.');
        }
        if (!endPoint || !Array.isArray(endPoint) || endPoint.length !== 2 || !endPoint[0] || !endPoint[1]) {
            throw new Error(`Hedef görevin (${gorev.adSoyad}) koordinatları geçersiz.`);
        }
        console.log('Rota çizim isteği:', { from: startPoint, to: endPoint });

        // 2. API isteğini yap
        const requestBody = {
            coordinates: [startPoint, endPoint]
        };

        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.openRouteServiceApiKey
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // 3. Hata kontrolünü iyileştir
        if (!response.ok) {
            const errorMessage = data.error?.message || JSON.stringify(data);
            throw new Error(`API Hatası: ${errorMessage}`);
        }

        if (data.routes && data.routes.length > 0) {
            const encodedRoute = data.routes[0].geometry;
            const routeCoordinates = decodePolyline(encodedRoute);

            const routeFeature = new ymaps3.YMapFeature({
                geometry: { type: 'LineString', coordinates: routeCoordinates },
                style: { stroke: [{ color: '#007BFF', width: 5 }] }
            });

            currentRouteFeature = routeFeature;
            mapInstance.addChild(currentRouteFeature);
        } else {
            throw new Error("Bu iki nokta arasında bir rota bulunamadı.");
        }

    } catch (error) {
        // Hata mesajını daha net göster
        alert(`Rota çizilemedi: ${error.message}`);
        console.error("Rota çizim hatası detayı:", error);
    } finally {
        if (clickedButton) {
            clickedButton.textContent = originalText;
            clickedButton.disabled = false;
        }
    }
}
