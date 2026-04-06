/* ============================================
   RoadAssist — js/apiLoader.js
   Dynamically load Google Maps API from backend
   ============================================ */

async function loadGoogleMapsAPI() {
  try {
    const response = await fetch('http://localhost:5001/api/config/maps');
    const data = await response.json();

    if (!data.apiKey) {
      console.error('Google Maps API key not available:', data.error);
      return false;
    }

    // Dynamically create and load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places,geometry`;
    script.defer = true;
    script.async = true;
    script.onerror = () => console.error('Failed to load Google Maps API');
    document.head.appendChild(script);

    return true;
  } catch (error) {
    console.error('Error loading Google Maps API key:', error);
    return false;
  }
}

// Load the API when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadGoogleMapsAPI);
} else {
  loadGoogleMapsAPI();
}
