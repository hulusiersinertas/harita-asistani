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
    let originalContent = ''; // Değişken adını 'content' yaptık

    if (clickedButton) {
        // HATA BURADAYDI: textContent yerine innerHTML kullanıyoruz.
        // Böylece <span class="material-icons">...</span> yapısını da hafızaya alıyoruz.
        originalContent = clickedButton.innerHTML; 
        
        // Butonu geçici olarak değiştir
        clickedButton.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> Hesap..';
        clickedButton.disabled = true;
    }

    clearCurrentRoute();

    try {
        const startPoint = await getUserLocation();
        const endPoint = [gorev.boylam, gorev.enlem];

        if (!startPoint || !Array.isArray(startPoint)) throw new Error('Konum alınamadı.');

        // ... API istekleri aynı kalıyor ...
        const requestBody = { coordinates: [startPoint, endPoint] };
        
        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.openRouteServiceApiKey
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'API Hatası');

        if (data.routes && data.routes.length > 0) {
            // ... Rota çizim kodları aynı ...
            const routeCoordinates = decodePolyline(data.routes[0].geometry);
            const routeFeature = new ymaps3.YMapFeature({
                geometry: { type: 'LineString', coordinates: routeCoordinates },
                style: { stroke: [{ color: '#007BFF', width: 5 }] }
            });
            currentRouteFeature = routeFeature;
            mapInstance.addChild(currentRouteFeature);
        } else {
            throw new Error("Rota bulunamadı.");
        }

    } catch (error) {
        alert(`Rota çizilemedi: ${error.message}`);
        console.error("Hata:", error);
    } finally {
        if (clickedButton) {
            // DÜZELTME: innerHTML ile orijinal ikonu ve metni geri yüklüyoruz.
            clickedButton.innerHTML = originalContent; 
            clickedButton.disabled = false;
        }
    }
}
