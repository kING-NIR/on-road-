/* ============================================
   RoadAssist — routes/config.js
   GET /api/config/maps — Returns Google Maps API key
   ============================================ */

const router = require('express').Router();

/* GET GOOGLE MAPS API KEY */
router.get('/maps', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'your_google_maps_api_key') {
    return res.status(400).json({ error: 'Google Maps API key not configured' });
  }

  res.json({ apiKey });
});

module.exports = router;
