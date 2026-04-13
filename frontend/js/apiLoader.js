/* ============================================
   RoadAssist — js/apiLoader.js
   Dynamically load Google Maps API from backend
   ============================================ */

async function loadGoogleMapsAPI() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiBase = isLocal ? 'http://localhost:5001/api' : 'https://road-asssist.onrender.com/api';
  
  try {
    const response = await fetch(`${apiBase}/config/maps`);
    const data = await response.json();

    if (!data.apiKey) {
      console.error('Google Maps API key not available:', data.error);
      return false;
    }

    // Dynamically create and load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places,geometry&callback=initGoogleMapGlobal`;
    script.defer = true;
    script.async = true;
    script.onerror = () => console.error('Failed to load Google Maps API');     
    
    // Add a global callback that checks if initMap exists
    window.initGoogleMapGlobal = function() {
      if (typeof window.initMap === 'function') {
        window.initMap();
      }
    };
    
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
