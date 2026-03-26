/* ============================================
   RoadAssist — map.js
   Google Maps integration + Socket live tracking
   ============================================ */

let mainMap = null;
let userLocation = null;
let markers = [];
let providerMarkers = {};
let directionsService, directionsRenderer;
let trafficLayer = null;
let currentFilter = 'all';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a24' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a24' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9090a8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d3f' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4d3000' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#ff4d00', lightness: -60 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0d18' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e1e2e' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#5a5a72' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e1e2e' }] }
];

/* ── INIT MAP ── */
function initMap() {
  const mapEl = document.getElementById('mainMap');
  if (!mapEl || !window.google) return;

  mainMap = new google.maps.Map(mapEl, {
    center: { lat: 17.385, lng: 78.4867 }, // Hyderabad default
    zoom: 13,
    styles: DARK_MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER }
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ map: mainMap, suppressMarkers: false });

  locateMe();
  loadNearbyProviders();
}

/* ── GEOLOCATION ── */
function locateMe() {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (mainMap) {
        mainMap.setCenter(userLocation);
        addUserMarker(userLocation);
      }
      loadNearbyProviders(userLocation);
    },
    () => { /* Use Hyderabad default */ },
    { enableHighAccuracy: true }
  );
}

function addUserMarker(location) {
  new google.maps.Marker({
    position: location, map: mainMap, title: 'You',
    icon: {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="#ff4d00" opacity="0.2"/>
          <circle cx="20" cy="20" r="10" fill="#ff4d00" stroke="white" stroke-width="3"/>
        </svg>`),
      scaledSize: new google.maps.Size(40, 40)
    },
    zIndex: 999
  });
}

/* ── LOAD PROVIDERS ── */
async function loadNearbyProviders(loc) {
  try {
    const params = loc ? `?lat=${loc.lat}&lng=${loc.lng}&radius=10` : '';
    const data = await apiCall(`/providers/nearby${params}`);
    renderProviders(data.data);
  } catch {
    // Use sample data in demo
    renderProviders(getSampleProviders());
  }
}

function getSampleProviders() {
  return [
    { id: 'p1', name: 'Raju Fuel Service', type: 'fuel', lat: 17.389, lng: 78.491, rating: 4.8, distance: 1.2, available: true },
    { id: 'p2', name: 'Sharma Auto Workshop', type: 'mechanic', lat: 17.382, lng: 78.480, rating: 4.6, distance: 2.4, available: true },
    { id: 'p3', name: 'City Towing Co.', type: 'towing', lat: 17.395, lng: 78.487, rating: 4.4, distance: 3.1, available: false },
    { id: 'p4', name: 'BatteryKing Roadside', type: 'battery', lat: 17.378, lng: 78.494, rating: 4.9, distance: 3.8, available: true }
  ];
}

function renderProviders(providers) {
  const iconMap = { fuel: '⛽', mechanic: '🔧', towing: '🚗', battery: '🔋', tyre: '🛞' };
  const colorMap = { fuel: '#ff4d00', mechanic: '#4d9fff', towing: '#ffbb00', battery: '#00d084', tyre: '#a855f7' };

  clearMarkers();

  const filtered = providers.filter(p => currentFilter === 'all' || p.type === currentFilter);
  const list = document.getElementById('providersList');
  list.innerHTML = '';

  filtered.forEach(provider => {
    if (!mainMap) return;
    // Map marker
    const marker = new google.maps.Marker({
      position: { lat: provider.lat, lng: provider.lng },
      map: mainMap, title: provider.name,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="0 0 44 50">
            <path d="M22 0 C10 0 0 10 0 22 C0 38 22 50 22 50 C22 50 44 38 44 22 C44 10 34 0 22 0Z" fill="${colorMap[provider.type] || '#ff4d00'}" ${!provider.available ? 'opacity="0.4"' : ''}/>
            <circle cx="22" cy="22" r="14" fill="white" opacity="0.15"/>
            <text x="22" y="28" text-anchor="middle" font-size="16">${iconMap[provider.type] || '📍'}</text>
          </svg>`),
        scaledSize: new google.maps.Size(44, 50)
      }
    });

    const infoWindow = new google.maps.InfoWindow({ content: `
      <div style="font-family:DM Sans,sans-serif;padding:8px;min-width:160px;background:#1e1e2e;color:#f0f0f5;border-radius:8px;">
        <strong>${provider.name}</strong><br>
        <span style="color:#9090a8">⭐ ${provider.rating} · ${provider.distance} km</span><br>
        <span style="color:${provider.available ? '#00d084' : '#ff3b3b'}">${provider.available ? '● Available' : '● Busy'}</span>
      </div>`
    });

    marker.addListener('click', () => {
      infoWindow.open(mainMap, marker);
      showTrackerPill(provider);
    });

    markers.push(marker);

    // List item
    const item = document.createElement('div');
    item.className = `provider-item ${provider.available ? '' : 'busy'}`;
    item.innerHTML = `
      <div class="provider-item-icon">${iconMap[provider.type] || '📍'}</div>
      <div class="provider-item-info">
        <span class="provider-item-name">${provider.name}</span>
        <span class="provider-item-meta">${provider.distance} km · ⭐ ${provider.rating} · ${provider.available ? 'Available' : 'Busy'}</span>
      </div>
      <div class="provider-item-actions">
        <span class="provider-dist">${provider.distance} km</span>
        <button class="dispatch-btn ${!provider.available ? 'disabled' : ''}" 
          ${!provider.available ? 'disabled' : `onclick="dispatchProvider('${provider.id}')"`}>
          ${provider.available ? 'Dispatch' : 'Busy'}
        </button>
      </div>`;
    item.addEventListener('click', () => {
      mainMap.setCenter({ lat: provider.lat, lng: provider.lng });
      mainMap.setZoom(16);
      showTrackerPill(provider);
    });
    list.appendChild(item);
  });
}

function clearMarkers() { markers.forEach(m => m.setMap(null)); markers = []; }

/* ── FILTER ── */
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
  loadNearbyProviders(userLocation);
}

/* ── DISPATCH ── */
async function dispatchProvider(providerId) {
  showToast('🚀 Dispatching provider...', 'info');
  try {
    const data = await apiCall('/requests', 'POST', { providerId, location: userLocation });
    showToast(`✓ ${data.data.providerName} is on the way!`, 'success');
    getDirections(userLocation, { lat: data.data.providerLat, lng: data.data.providerLng });
  } catch {
    showToast('✓ Provider dispatched! (Demo mode)', 'success');
  }
}

function getDirections(origin, destination) {
  if (!directionsService || !origin) return;
  directionsService.route({ origin, destination, travelMode: 'DRIVING' }, (result, status) => {
    if (status === 'OK') directionsRenderer.setDirections(result);
  });
}

/* ── MAP CONTROLS ── */
function toggleLayer(type) {
  if (type === 'traffic') {
    if (!trafficLayer) {
      trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(mainMap);
      showToast('Traffic layer ON', 'info');
    } else {
      trafficLayer.setMap(null);
      trafficLayer = null;
      showToast('Traffic layer OFF', 'info');
    }
  } else if (type === 'satellite') {
    const current = mainMap.getMapTypeId();
    mainMap.setMapTypeId(current === 'roadmap' ? 'satellite' : 'roadmap');
  }
}

function fitAllMarkers() {
  if (!markers.length) return;
  const bounds = new google.maps.LatLngBounds();
  markers.forEach(m => bounds.extend(m.getPosition()));
  mainMap.fitBounds(bounds);
}

/* ── TRACKER PILL ── */
function showTrackerPill(provider) {
  const pill = document.getElementById('trackerPill');
  document.getElementById('trackerName').textContent = provider.name;
  document.getElementById('trackerEta').textContent = `~${Math.round(provider.distance * 3)} min away`;
  pill.style.display = 'flex';
}
function closeTracker() { document.getElementById('trackerPill').style.display = 'none'; }

/* ── LIVE PROVIDER TRACKING (Socket) ── */
window.addEventListener('providerLocation', (e) => {
  const { providerId, lat, lng } = e.detail;
  if (!mainMap) return;
  if (providerMarkers[providerId]) {
    providerMarkers[providerId].setPosition({ lat, lng });
  } else {
    providerMarkers[providerId] = new google.maps.Marker({
      position: { lat, lng }, map: mainMap,
      icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#00d084" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-size="14">👷</text></svg>`), scaledSize: new google.maps.Size(36, 36) }
    });
  }
});

/* ── GOOGLE MAPS CALLBACK ── */
window.initMap = initMap;

document.addEventListener('DOMContentLoaded', () => {
  if (!window.google) {
    // Google Maps not loaded (no API key) — show a placeholder
    const mapEl = document.getElementById('mainMap');
    if (mapEl) mapEl.style.background = '#1a1a24';
  }
});
