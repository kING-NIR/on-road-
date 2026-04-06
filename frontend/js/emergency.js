/* ============================================
   RoadAssist — emergency.js
   Multi-step form, geolocation, dispatch
   ============================================ */

let currentStep = 1;
let userLocation = null;
let emergencyMap = null;
let userMarker = null;
let providerMarker = null;
let currentRequestId = null;
let selectedImages = []; // Store selected image files
let cameraStream = null;

/* ── STEP NAVIGATION ── */
function nextStep(step) {
  if (!validateStep(currentStep)) return;
  document.getElementById(`step${currentStep}`)?.classList.remove('active');
  document.querySelectorAll('.step-dot').forEach((d, i) => {
    if (i < step - 1) d.classList.add('done');
    else if (i === step - 1) { d.classList.add('active'); d.classList.remove('done'); }
    else d.classList.remove('active', 'done');
  });
  document.querySelectorAll('.step-line').forEach((l, i) => {
    l.classList.toggle('done', i < step - 1);
  });
  currentStep = step;
  document.getElementById(`step${step}`)?.classList.add('active');
  if (step === 3) populateConfirm();
}

function validateStep(step) {
  if (step === 1) {
    const sel = document.querySelector('input[name="serviceType"]:checked');
    if (!sel) { showToast('Please select a service type', 'error'); return false; }
  }
  if (step === 2) {
    if (!userLocation && !document.getElementById('locationInput').value.trim()) {
      showToast('Please provide your location', 'error'); return false;
    }
    if (!document.getElementById('vehicleType').value) {
      showToast('Please select your vehicle type', 'error'); return false;
    }
  }
  return true;
}

function populateConfirm() {
  const service = document.querySelector('input[name="serviceType"]:checked')?.value || '—';
  const loc = document.getElementById('locationInput').value || 'GPS detected';
  const vtype = document.getElementById('vehicleType').value;
  const vnum = document.getElementById('vehicleNum').value;
  const etaMap = { fuel: '~15 min', towing: '~20 min', mechanic: '~18 min', battery: '~12 min', tyre: '~10 min', sos: '~8 min (PRIORITY)' };

  document.getElementById('confirmService').textContent = service.charAt(0).toUpperCase() + service.slice(1);
  document.getElementById('confirmLocation').textContent = loc;
  document.getElementById('confirmVehicle').textContent = `${vtype}${vnum ? ' · ' + vnum : ''}`;
  document.getElementById('confirmETA').textContent = etaMap[service] || '~15 min';
  if (service === 'sos') {
    document.getElementById('confirmPriority').textContent = 'CRITICAL — TOP PRIORITY';
    document.getElementById('confirmPriority').style.color = 'var(--red)';
  }
}

/* ── GEOLOCATION ── */
function detectLocation() {
  const status = document.getElementById('locationStatus');
  status.className = 'location-status loading';
  status.textContent = '⟳ Detecting location...';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${userLocation.lat}&lon=${userLocation.lng}&format=json`);
        const data = await res.json();
        const addr = data.display_name || `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
        document.getElementById('locationInput').value = addr;
        status.className = 'location-status success';
        status.textContent = `✓ Location detected`;
        updateEmergencyMap(userLocation);
      } catch {
        document.getElementById('locationInput').value = `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
        status.className = 'location-status success';
        status.textContent = '✓ GPS coordinates captured';
      }
    },
    (err) => {
      status.className = 'location-status error';
      status.textContent = '✗ Could not detect location. Please enter manually.';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function updateEmergencyMap(location) {
  if (!window.google) return;
  const mapEl = document.getElementById('emergencyMap');
  if (!emergencyMap) {
    mapEl.innerHTML = '';
    emergencyMap = new google.maps.Map(mapEl, {
      center: location, zoom: 15,
      styles: getMapStyles(),
      disableDefaultUI: true
    });
  } else {
    emergencyMap.setCenter(location);
  }
  if (userMarker) userMarker.setMap(null);
  userMarker = new google.maps.Marker({
    position: location, map: emergencyMap,
    title: 'Your Location',
    icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#ff4d00" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="white"/></svg>`), scaledSize: new google.maps.Size(32, 32) }
  });
}

/* ── SUBMIT REQUEST ── */
async function submitRequest() {
  const phone = document.getElementById('phoneNum').value.trim();
  if (!phone) { showToast('Please enter your phone number', 'error'); return; }

  const btn = document.getElementById('submitBtn');
  btn.textContent = '⟳ Dispatching...';
  btn.disabled = true;

  try {
    const payload = {
      serviceType: document.querySelector('input[name="serviceType"]:checked')?.value,
      location: userLocation || { lat: 17.385, lng: 78.4867 },
      locationText: document.getElementById('locationInput').value,
      vehicleType: document.getElementById('vehicleType').value,
      vehicleNumber: document.getElementById('vehicleNum').value,
      description: document.getElementById('description').value,
      phone
    };

    const data = await apiCall('/requests', 'POST', payload);
    currentRequestId = data.data.requestId;

    // Upload images if any
    if (selectedImages.length > 0) {
      btn.textContent = '📸 Uploading images...';
      await uploadImages(currentRequestId, selectedImages);
      showToast(`✓ ${selectedImages.length} image(s) uploaded`, 'success');
    }

    showToast('🆘 Help dispatched! Provider assigned.', 'success');
    showProviderCard(data.data);
    listenToRequest(currentRequestId);

  } catch (err) {
    // Demo fallback
    showToast('🆘 Request submitted! (Demo mode)', 'success');
    showProviderCard({ providerName: 'Raju Kumar', rating: 4.8, eta: 15, requestId: 'DEMO-001' });
  }
  btn.textContent = '✓ Help is on the way!';
}

function showProviderCard(data) {
  const card = document.getElementById('providerCard');
  document.getElementById('providerName').textContent = data.providerName || 'Assigning...';
  document.getElementById('providerRating').textContent = `⭐ ${data.rating || 4.8} rating`;
  document.getElementById('providerETA').textContent = `ETA: ~${data.eta || 15} min`;
  card.style.display = 'block';
}

function listenToRequest(requestId) {
  if (!socket) return;
  socket.emit('join:request', { requestId });
  window.addEventListener('requestUpdate', (e) => {
    const { status } = e.detail;
    const statusSteps = { assigned: 'statusAssigned', enRoute: 'statusEnRoute', arrived: 'statusArrived' };
    if (statusSteps[status]) {
      document.getElementById(statusSteps[status])?.classList.add('active');
    }
  });
  window.addEventListener('providerLocation', (e) => {
    const { lat, lng } = e.detail;
    if (emergencyMap) {
      if (providerMarker) providerMarker.setMap(null);
      providerMarker = new google.maps.Marker({
        position: { lat, lng }, map: emergencyMap, title: 'Provider',
        icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#00d084" stroke="white" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-size="16">👷</text></svg>`), scaledSize: new google.maps.Size(36, 36) }
      });
    }
  });
}

function callProvider() { showToast('Calling provider... (Demo)', 'info'); }
function shareLocation() {
  if (userLocation) {
    navigator.clipboard.writeText(`https://maps.google.com/?q=${userLocation.lat},${userLocation.lng}`);
    showToast('📍 Location link copied!', 'success');
  }
}

function getMapStyles() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1a1a24' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a24' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9090a8' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d3f' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ff4d00', lightness: -60 }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111118' }] }
  ];
}

/* ── IMAGE HANDLING ── */
function handleImageSelection(e) {
  const files = Array.from(e.target.files || []);
  const maxFiles = 5;
  
  if (selectedImages.length + files.length > maxFiles) {
    showToast(`Max ${maxFiles} images allowed`, 'error');
    return;
  }

  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      selectedImages.push(file);
    } else {
      showToast('Only image files allowed', 'error');
    }
  });

  displayImagePreviews();
}

function displayImagePreviews() {
  const wrap = document.getElementById('imagePreviewWrap');
  wrap.innerHTML = '';

  selectedImages.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'image-preview-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="preview" class="preview-img">
        <button type="button" class="remove-img-btn" onclick="removeImage(${index})">✕</button>
      `;
      wrap.appendChild(div);
    };
    reader.readAsDataURL(file);
  });

  // Show count
  if (selectedImages.length > 0) {
    const countDiv = document.createElement('div');
    countDiv.style.marginTop = '8px';
    countDiv.style.fontSize = '12px';
    countDiv.style.color = 'var(--accent)';
    countDiv.textContent = `${selectedImages.length} image(s) selected`;
    wrap.appendChild(countDiv);
  }
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  displayImagePreviews();
  showToast('Image removed', 'info');
}

function startCamera() {
  const video = document.getElementById('cameraPreview');
  const captureBtn = document.getElementById('captureBtn');
  
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      cameraStream = stream;
      video.srcObject = stream;
      video.style.display = 'block';
      video.play();
      captureBtn.style.display = 'block';
      document.getElementById('takeCameraBtn').textContent = '❌ Close Camera';
      document.getElementById('takeCameraBtn').onclick = stopCamera;
    })
    .catch(err => {
      showToast('Camera permission denied or not available', 'error');
      console.error(err);
    });
}

function stopCamera() {
  const video = document.getElementById('cameraPreview');
  const captureBtn = document.getElementById('captureBtn');
  
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  video.style.display = 'none';
  captureBtn.style.display = 'none';
  document.getElementById('takeCameraBtn').textContent = '📹 Take Photo';
  document.getElementById('takeCameraBtn').onclick = startCamera;
}

function capturePhoto() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    selectedImages.push(file);
    displayImagePreviews();
    showToast('✓ Photo captured', 'success');
    stopCamera();
  }, 'image/jpeg', 0.8);
}

async function uploadImages(requestId, files) {
  const formData = new FormData();
  files.forEach(file => formData.append('images', file));

  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/requests/${requestId}/images`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload images');
  }

  return response.json();
}

// Listen for file input changes
document.addEventListener('DOMContentLoaded', () => {
  const imageInput = document.getElementById('imageInput');
  if (imageInput) {
    imageInput.addEventListener('change', handleImageSelection);
  }
});

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  // Auto-select from dashboard navigation
  const saved = localStorage.getItem('selectedService');
  if (saved) {
    const radio = document.querySelector(`input[name="serviceType"][value="${saved}"]`);
    if (radio) { radio.checked = true; radio.closest('.service-opt').style.borderColor = 'var(--accent)'; }
    localStorage.removeItem('selectedService');
  }
  detectLocation();
});
