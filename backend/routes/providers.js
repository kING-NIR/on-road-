/* ============================================
   RoadAssist — routes/providers.js
   GET    /api/providers/nearby   - Nearby providers (with ML scores)
   GET    /api/providers/:id      - Provider profile
   POST   /api/providers          - Register as provider
   PATCH  /api/providers/location - Update live location
   PATCH  /api/providers/availability - Toggle availability
   ============================================ */

const router = require('express').Router();
const { Provider, User, Request } = require('../models');
const { protect, requireRole } = require('../middleware/auth');
const { Op, literal } = require('sequelize');

/* Haversine formula (in km) */
function haversine(lat1, lng1, lat2, lng2) {
  if (!lat2 || !lng2) return null;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2);
}

/* ── GET NEARBY PROVIDERS ── */
router.get('/nearby', async (req, res) => {
  try {
    const { lat = 17.385, lng = 78.4867, radius = 15, type } = req.query;
    const userLat = parseFloat(lat), userLng = parseFloat(lng);

    const where = { isAvailable: true };
    if (type) where.serviceTypes = { [Op.like]: `%${type}%` };

    let providers = await Provider.findAll({
      where,
      attributes: ['id','name','serviceTypes','rating','totalJobs','isAvailable','currentLat','currentLng','phone','coverageRadius']
    });

    // Filter by radius and attach distance
    providers = providers
      .map(p => {
        const dist = haversine(userLat, userLng, +p.currentLat, +p.currentLng);
        return { ...p.toJSON(), distance: dist };
      })
      .filter(p => p.distance !== null && p.distance <= +radius)
      .sort((a, b) => {
        // Simple scoring: weighted by distance (60%) + rating (40%)
        const scoreA = (1 / (a.distance + 0.1)) * 0.6 + (a.rating / 5) * 0.4;
        const scoreB = (1 / (b.distance + 0.1)) * 0.6 + (b.rating / 5) * 0.4;
        return scoreB - scoreA;
      });

    res.json({ success: true, data: providers, count: providers.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── REGISTER AS PROVIDER ── */
router.post('/', protect, async (req, res) => {
  try {
    const existing = await Provider.findOne({ where: { userId: req.user.id } });
    if (existing) return res.status(409).json({ success: false, message: 'Already registered as provider' });

    const { name, serviceTypes, vehicleInfo, coverageRadius } = req.body;
    const provider = await Provider.create({
      userId: req.user.id,
      name: name || req.user.name,
      phone: req.user.phone,
      serviceTypes,
      vehicleInfo,
      coverageRadius: coverageRadius || 20
    });
    await req.user.update({ role: 'provider' });
    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── UPDATE LIVE LOCATION ── */
router.patch('/location', protect, requireRole('provider', 'admin'), async (req, res) => {
  try {
    const { lat, lng, speed, heading } = req.body;
    const provider = await Provider.findOne({ where: { userId: req.user.id } });
    if (!provider) return res.status(404).json({ success: false, message: 'Provider profile not found' });

    await provider.update({ currentLat: lat, currentLng: lng });

    // Emit to all active requests
    const io = req.app.get('io');
    const activeReqs = await Request.findAll({
      where: { providerId: provider.id, status: { [Op.in]: ['assigned','enRoute','arrived'] } }
    });
    activeReqs.forEach(r => {
      io.to(`request:${r.id}`).emit('provider:location', { providerId: provider.id, lat, lng, speed, heading });
    });

    // Broadcast for map page
    io.emit('provider:location', { providerId: provider.id, lat, lng });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── TOGGLE AVAILABILITY ── */
router.patch('/availability', protect, requireRole('provider','admin'), async (req, res) => {
  try {
    const provider = await Provider.findOne({ where: { userId: req.user.id } });
    if (!provider) return res.status(404).json({ success: false, message: 'Not found' });
    await provider.update({ isAvailable: !provider.isAvailable });
    res.json({ success: true, data: { isAvailable: provider.isAvailable } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET PROVIDER PROFILE ── */
router.get('/:id', async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id, {
      include: [{ model: User, as: 'user', attributes: ['name','email'] }]
    });
    if (!provider) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
