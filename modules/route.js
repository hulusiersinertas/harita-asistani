// OpenRouteService API'si ile rota çizme mantığını yönetir.

import { config } from './config.js';
import { getUserLocation } from './navigation.js';

let currentRouteFeature = null; // Haritadaki mevcut rota katmanını saklar
let mapInstance = null;

/**
 * Rota çizim modülünü başlatır.
 * @param {ymaps3.YMap} map - Harita nesnesi.
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
 * @param {object} gorev - Hedef görev nesnesi.
 * @param {HTMLElement} [clickedButton] - Tıklanan buton (isteğe bağlı).
 */
export async function drawRouteToTask(gorev, clickedButton) {
    let originalText = '';
    if (clickedButton) {
        originalText = clickedButton.textContent;
        clickedButton.textContent = 'Hesaplanıyor...';
        clickedButton.disabled = true;
    }

    clearCurrentRoute(); // Yeni rota çizmeden önce eskisini temizle

    try {
        const startPoint = await getUserLocation();
        const endPoint = [gorev.boylam, gorev.enlem];

        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
                'Content-Type': 'application/json',
                'Authorization': config.openRouteServiceApiKey
            },
            body: JSON.stringify({ "coordinates": [startPoint, endPoint] })
        });

        const data = await response.json();

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
            throw new Error(data.error?.message || "Bu iki nokta arasında bir rota bulunamadı.");
        }

    } catch (error) {
        alert(`Rota çizilemedi: ${error.message}`);
    } finally {
        if (clickedButton) {
            clickedButton.textContent = originalText;
            clickedButton.disabled = false;
        }
    }
}