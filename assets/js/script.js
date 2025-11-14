document.addEventListener('DOMContentLoaded', () => {
    // --- API KEYS (Updated with your keys) ---
    const OWM_API_KEY = '3c07acc541b22886290d2e7ff1d9536d'; // Your OpenWeatherMap API Key
    const OC_API_KEY = '9977884d23884e61812bbf7ce103cc5f'; // Your OpenCage API Key

    // --- DOM ELEMENTS ---
    const heroView = document.getElementById('hero-view');
    const mapView = document.getElementById('map-view');
    const locationInfo = document.getElementById('location-info');
    const countryName = document.getElementById('country-name');
    const areaName = document.getElementById('area-name');
    const tempInfo = document.getElementById('temp-info');
    const humidityInfo = document.getElementById('humidity-info');
    const precipitationInfo = document.getElementById('precipitation-info');
    const floodRiskInfo = document.getElementById('flood-risk-info');
    const themeToggle = document.getElementById('theme-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    const aiAssistant = document.getElementById('ai-assistant');
    const aiCloseBtn = document.getElementById('ai-close-btn');
    const aiMinimizeBtn = document.getElementById('ai-minimize-btn');
    const predictBtn = document.getElementById('predict-btn');
    const aiResult = document.getElementById('ai-result');
    const predictionOutput = document.getElementById('prediction-output');
    const telegramInfoBtn = document.getElementById('telegram-info-btn');
    const telegramModal = document.getElementById('telegram-modal');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const mobileNav = document.getElementById('mobile-nav');

    let currentUser = null;
    let map = null;
    let marker = null;
    let lastClickedLatLng = null;
    let heatLayer = null;

    // --- HEADER & NAV LOGIC ---
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
            mobileNav.classList.toggle('open');
        });
    }

    // --- AUTHENTICATION CHECK ---
    const userData = sessionStorage.getItem('loggedInUser');
    if (userData) {
        currentUser = JSON.parse(userData);
        heroView.style.display = 'none';
        mapView.style.display = 'grid';
        initializeMap();
        // Show AI assistant after a short delay
        setTimeout(() => {
            aiAssistant.classList.remove('hidden');
            aiAssistant.classList.add('visible');
        }, 1000);
    } else {
        heroView.style.display = 'flex'; // Use flex for the hero page
        mapView.style.display = 'none';
    }

    // --- EVENT LISTENERS ---
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
        });
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('loggedInUser');
            window.location.reload();
        });
    }
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            aiAssistant.classList.add('hidden');
            aiAssistant.classList.remove('visible');
        });
    }

    if (aiMinimizeBtn) {
        aiMinimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            aiAssistant.classList.toggle('minimized');
        });
    }

    // Click on the minimized circle to expand it
    aiAssistant.addEventListener('click', () => {
        if (aiAssistant.classList.contains('minimized')) {
            aiAssistant.classList.remove('minimized');
        }
    });

    if (predictBtn) {
        predictBtn.addEventListener('click', runAIPrediction);
        predictBtn.disabled = true; // Disabled until a location is clicked
    }

    if (telegramInfoBtn) {
        telegramInfoBtn.addEventListener('click', () => {
            telegramModal.classList.remove('hidden');
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            telegramModal.classList.add('hidden');
        });
    }

    // Close modal if overlay is clicked
    if (telegramModal) {
        telegramModal.addEventListener('click', (e) => {
            if (e.target === telegramModal) {
                telegramModal.classList.add('hidden');
            }
        });
    }

    makeDraggable(aiAssistant);

    // --- MAP INITIALIZATION ---
    function initializeMap() {
        map = L.map('map', {
            attributionControl: false
        }).setView([20.5937, 78.9629], 5);

        // Check for URL parameters to center the map
        const urlParams = new URLSearchParams(window.location.search);
        const lat = urlParams.get('lat');
        const lon = urlParams.get('lon');
        const zoom = urlParams.get('zoom');

        if (lat && lon) {
            const targetLatLng = [parseFloat(lat), parseFloat(lon)];
            map.setView(targetLatLng, zoom || 13);
            if (marker) {
                marker.setLatLng(targetLatLng);
            } else {
                marker = L.marker(targetLatLng).addTo(map);
            }
            fetchWeatherData(lat, lon);
            predictBtn.disabled = false;
        }


        const baseLayers = {
            "Street": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map),
            "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }),
            "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            })
        };

        const precipitationLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`);
        const tempLayer = L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`);
        const windLayer = L.tileLayer(`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`);
        const cloudsLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`);

        // --- NASA GPM Layer ---
        const nasaPrecipLayer = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GPM_3IMERGHHE_Precipitation_Rate/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png', {
            attribution: 'NASA GPM',
            maxNativeZoom: 9,
            opacity: 0.7
        });

        const overlayLayers = {
            "Precipitation (OWM)": precipitationLayer,
            "Temperature (OWM)": tempLayer,
            "Wind Speed (OWM)": windLayer,
            "Clouds (OWM)": cloudsLayer,
            "Precipitation (NASA GPM)": nasaPrecipLayer
        };

        L.control.layers(baseLayers, overlayLayers).addTo(map);
        
        // --- Legend Control ---
        const legend = L.control({position: 'bottomright'});

        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = [0, 1, 2, 5, 10, 20, 50]; // Precipitation levels in mm
            const colors = [
                '#eff3ff', '#bdd7e7', '#6baed6',
                '#3182bd', '#08519c', '#08306b', '#000000'
            ];
            
            div.innerHTML = '<h4>Precipitation (mm)</h4>';
            // loop through our density intervals and generate a label with a colored square for each interval
            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + colors[i] + '"></i> ' +
                    grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+');
            }
            return div;
        };

        legend.addTo(map);

        L.control.attribution({
            position: 'bottomright',
            prefix: '' // Clear the default prefix
        }).addTo(map);

        map.on('click', function(e) {
            const { lat, lng } = e.latlng;
            lastClickedLatLng = e.latlng; // Store the clicked location
            locationInfo.textContent = `Lat: ${lat.toFixed(4)}, Lon: ${lng.toFixed(4)}`;

            if (marker) {
                marker.setLatLng(e.latlng);
            } else {
                marker = L.marker(e.latlng).addTo(map);
            }
            
            fetchWeatherData(lat, lng);
            predictBtn.disabled = false; // Enable prediction button
            aiResult.classList.add('hidden'); // Hide previous results
        });

        setTimeout(() => map.invalidateSize(), 10);
    }


    // --- Draggable Panel Logic ---
    function makeDraggable(el) {
        const header = el.querySelector('.ai-header');
        if (!header) return; // Only drag by the header

        let isDown = false;
        let offset = [0, 0];

        // Ensure the element is positioned absolutely
        el.style.position = 'absolute';

        // Center the element initially if no position is set
        if (!el.style.left && !el.style.top) {
            el.style.left = `${(window.innerWidth - el.offsetWidth) / 2}px`;
            el.style.top = '20px'; // Start near the top
        }


        function onStart(e) {
            isDown = true;
            const p = e.touches ? e.touches[0] : e;
            offset = [
                el.offsetLeft - p.clientX,
                el.offsetTop - p.clientY
            ];
            header.style.cursor = 'grabbing';
            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
        }

        function onEnd() {
            isDown = false;
            header.style.cursor = 'grab';
            document.body.style.userSelect = '';
        }

        function onMove(e) {
            if (!isDown) return;
            e.preventDefault(); // Prevent scrolling on touch devices
            const p = e.touches ? e.touches[0] : e;

            let newX = p.clientX + offset[0];
            let newY = p.clientY + offset[1];

            // Constrain movement within the viewport
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight;

            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
            el.style.transform = ''; // Clear transform to use top/left
        }

        header.style.cursor = 'grab';
        header.addEventListener('mousedown', onStart);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('mousemove', onMove);

        header.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
    }


    // --- AI PREDICTION & VISUALIZATION ---
    function runAIPrediction() {
        if (!lastClickedLatLng) {
            alert("Please select a location on the map first.");
            return;
        }

        // Simulate fetching extra data (elevation, soil type, etc.)
        // In a real app, this would involve more API calls.
        const simulatedData = {
            elevation: Math.random() * 200, // 0-200m
            soilPermeability: Math.random(), // 0-1 (low to high)
            riverDistance: Math.random() * 5000, // 0-5km
        };

        // Simulate fetching 48-hour rainfall forecast
        const forecastPrecip = Math.random() * 50; // 0-50mm

        // --- Simulated AI Model ---
        let probability = 0;
        // Higher probability for higher forecast rainfall
        probability += forecastPrecip * 1.2;
        // Lower probability for higher elevation
        probability -= simulatedData.elevation * 0.1;
        // Lower probability for more permeable soil
        probability -= simulatedData.soilPermeability * 20;
        // Higher probability for being closer to a river
        if (simulatedData.riverDistance < 1000) {
            probability += 20;
        }

        // Clamp probability between 5% and 95%
        probability = Math.max(5, Math.min(95, probability));

        predictionOutput.textContent = `~${probability.toFixed(0)}% Probability`;
        aiResult.classList.remove('hidden');

        // Visualize the prediction as a heatmap
        visualizePrediction(lastClickedLatLng, probability);
    }

    function visualizePrediction(center, probability) {
        // Remove old heatmap if it exists
        if (heatLayer) {
            map.removeLayer(heatLayer);
        }

        // Generate random points around the center to create a heatmap effect
        const heatPoints = [];
        const radius = 0.1; // ~11km radius for the points
        const numPoints = 100;

        for (let i = 0; i < numPoints; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * radius;
            const lat = center.lat + distance * Math.cos(angle);
            const lng = center.lng + distance * Math.sin(angle);
            // Intensity is based on probability
            const intensity = (probability / 100) * (1 - (distance / radius));
            heatPoints.push([lat, lng, intensity]);
        }

        heatLayer = L.heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            gradient: {0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red'}
        }).addTo(map);
    }


    // --- DATA FETCHING & NOTIFICATION CHAIN ---
    async function fetchWeatherData(lat, lon) {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OWM_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Weather data not found (Status: ${response.status})`);
            const data = await response.json();

            const weather = {
                temp: data.main.temp,
                humidity: data.main.humidity,
                precip: data.rain ? data.rain['1h'] : 0
            };

            tempInfo.textContent = `${weather.temp} °C`;
            humidityInfo.textContent = `${weather.humidity}%`;
            precipitationInfo.textContent = `${weather.precip} mm`;

            const risk = calculateFloodRisk(weather.temp, weather.humidity, weather.precip);
            floodRiskInfo.textContent = risk.level;
            floodRiskInfo.style.color = risk.color;
            weather.risk = risk;

            // Fetch geographic data for the dashboard
            fetchGeographicData(lat, lon, weather, true);

            if (currentUser && currentUser.telegramChatId) {
                // This will send the notification
                fetchGeographicData(lat, lon, weather, false);
            }
        } catch (error) {
            console.error("Error fetching weather data:", error);
            alert(error.message);
        }
    }

    async function fetchGeographicData(lat, lon, weatherData, updateDashboard) {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OC_API_KEY}&no_annotations=1`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Geographic data not found.');
            const data = await response.json();

            const components = data.results[0].components;
            const geo = {
                country: components.country || 'N/A',
                district: components.state_district || components.county || 'N/A',
                place: components.village || components.town || components.city || 'N/A'
            };

            if (updateDashboard) {
                countryName.textContent = geo.country;
                areaName.textContent = `${geo.place}, ${geo.district}`;
            } else {
                sendTelegramNotification(weatherData, geo);
            }
        } catch (error) {
            console.error("Error fetching geographic data:", error);
            if (!updateDashboard) {
                sendTelegramNotification(weatherData, { country: 'N/A', district: 'N/A', place: 'N/A' });
            }
        }
    }

    function sendTelegramNotification(weather, geo) {
        const message = `
🌊 *Flood Risk Report* 🌊
---------------------------------
*Location:* ${geo.place}, ${geo.district}, ${geo.country}
*Coordinates:* ${locationInfo.textContent}
---------------------------------
*Weather Details:*
🌡️ Temperature: ${weather.temp} °C
💧 Humidity: ${weather.humidity}%
🌧️ Precipitation (1hr): ${weather.precip} mm
---------------------------------
*Risk Assessment:*
🚨 *${weather.risk.level}*
        `;

        fetch('http://localhost:3000/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chatId: currentUser.telegramChatId,
                message: message.trim()
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Automatic Telegram notification sent!');
            } else {
                console.error('Failed to send Telegram notification:', data.message);
            }
        })
        .catch(error => {
            console.error('Error sending notification request:', error);
        });
    }

    function calculateFloodRisk(temp, humidity, precip) {
        let score = 0;
        if (precip > 10) score += 3;
        else if (precip > 2.5) score += 2;
        else if (precip > 0) score += 1;
        if (humidity > 85) score += 2;
        if (temp > 0) score += 1;

        if (score >= 5) return { level: 'High Risk', color: '#e74c3c' };
        if (score >= 3) return { level: 'Moderate Risk', color: '#f39c12' };
        return { level: 'Low Risk', color: '#2ecc71' };
    }

    window.addEventListener('resize', () => {
      if (map) {
        setTimeout(() => map.invalidateSize(), 200);
      }
    });
});