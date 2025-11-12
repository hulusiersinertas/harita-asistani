/**
 * Verilen göreve OpenRouteService kullanarak bir rota çizer. (Son ve Düzeltilmiş Versiyon)
 * @param {object} gorev 
 * @param {HTMLElement} clickedButton
 */
async function drawRoute(gorev, clickedButton) {
    const originalText = clickedButton.textContent;
    clickedButton.textContent = 'Hesaplanıyor...';
    clickedButton.disabled = true;

    // Önceki rotayı haritadan temizle
    if (currentRoute) {
        mapInstance.removeChild(currentRoute);
        currentRoute = null;
    }

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
            body: JSON.stringify({
                "coordinates": [startPoint, endPoint]
            })
        });

        const data = await response.json();
        console.log("OpenRouteService Yanıtı:", data);

        // --- DÜZELTME 1: 'features' yerine 'routes' kontrolü ---
        // API yanıtında 'routes' dizisi var mı ve bu dizi boş değil mi diye kontrol et.
        if (data.routes && data.routes.length > 0) {
            
            // --- DÜZELTME 2: 'features' yerine 'routes' içinden veri alma ---
            const routeCoordinates = data.routes[0].geometry.coordinates;

            const routeFeature = new ymaps3.YMapFeature({
                geometry: {
                    type: 'LineString',
                    coordinates: routeCoordinates
                },
                style: {
                    stroke: [{ color: '#007BFF', width: 5 }]
                }
            });

            currentRoute = routeFeature;
            mapInstance.addChild(currentRoute);
        } else {
            throw new Error(data.error?.message || "Bu iki nokta arasında bir rota bulunamadı.");
        }

    } catch (error) {
        alert(`Rota çizilemedi: ${error.message}`);
    } finally {
        clickedButton.textContent = originalText;
        clickedButton.disabled = false;
    }
}
