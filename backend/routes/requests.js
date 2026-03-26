/* ============================================
   RoadAssist — routes/requests.js
   POST   /api/requests          - Create request
   GET    /api/requests          - List user requests
   GET    /api/requests/:id      - Get single request
   PATCH  /api/requests/:id      - Update status
   POST   /api/requests/:id/rate - Rate a completed request
   ============================================ */

const router  = require('express').Router();
const axios   = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Op }  = require('sequelize');
const { Request, Provider, User } = require('../models');
const { protect, requireRole } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/* ── HELPER: Generate request number ── */
const genReqNumber = () => `RA${Date.now().toString(36).toUpperCase()}`;

/* ── HELPER: Call ML service for best provider ── */
async function getBestProvider(serviceType, lat, lng) {
  try {
    const res = await axios.post(`${process.env.ML_SERVICE_URL}/recommend`, {
      service_type: serviceType, lat, lng
    }, { timeout: 3000 });
    return res.data.provider_id;
  } catch {
    // Fallback: nearest available provider
    const providers = await Provider.findAll({
      where: {
        serviceTypes: { [Op.like]: `%${serviceType}%` },
        isAvailable: true,
        isVerified: true
      }
    });
    if (!providers.length) return null;
    // Haversine distance sort
    const sorted = providers.map(p => ({
      ...p.toJSON(),
      dist: haversine(lat, lng, +p.currentLat, +p.currentLng)
    })).sort((a, b) => a.dist - b.dist);
    return sorted[0]?.id || null;
  }
}

function haversine(lat1, lng1, lat2, lng2) {
  if (!lat2 || !lng2) return 9999;
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── CREATE REQUEST ── */
router.post('/', protect, [
  body('serviceType').isIn(['fuel','towing','mechanic','battery','tyre','sos']),
  body('locationLat').optional().isFloat(),
  body('locationLng').optional().isFloat(),
  body('phone').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { serviceType, locationLat, locationLng, locationText, vehicleType, vehicleNumber, description, phone } = req.body;
    const lat = locationLat || req.body.location?.lat || 17.385;
    const lng = locationLng || req.body.location?.lng || 78.4867;

    // Get priority
    const priority = serviceType === 'sos' ? 'critical' : serviceType === 'towing' ? 'high' : 'standard';

    // ML-based provider selection
    const providerId = await getBestProvider(serviceType, lat, lng);

    // Estimate ETA
    const etaMap = { fuel: 15, towing: 20, mechanic: 18, battery: 12, tyre: 10, sos: 8 };
    const estimatedETA = etaMap[serviceType];

    const request = await Request.create({
      requestNumber: genReqNumber(),
      userId: req.user.id,
      providerId,
      serviceType,
      status: providerId ? 'assigned' : 'pending',
      locationLat: lat,
      locationLng: lng,
      locationText,
      vehicleType, vehicleNumber, description, phone,
      priority, estimatedETA
    });

    // Fetch provider info
    let providerData = null;
    if (providerId) {
      const provider = await Provider.findByPk(providerId);
      providerData = { providerName: provider.name, rating: provider.rating, providerLat: +provider.currentLat, providerLng: +provider.currentLng };
    }

    // Emit socket events
    const io = req.app.get('io');
    io.emit('activity:new', {
      user: req.user.name,
      serviceType,
      location: locationText || `${lat.toFixed(3)},${lng.toFixed(3)}`,
      status: request.status
    });
    if (providerId) {
      io.to(`provider:${providerId}`).emit('request:new', {
        requestId: request.id,
        serviceType, lat, lng, phone
      });
    }

    res.status(201).json({
      success: true,
      data: {
        requestId: request.id,
        requestNumber: request.requestNumber,
        status: request.status,
        estimatedETA,
        ...providerData
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── LIST REQUESTS (user's own) ── */
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { rows, count } = await Request.findAndCountAll({
      where,
      include: [{ model: Provider, as: 'provider', attributes: ['name', 'rating', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: +limit,
      offset: (+page - 1) * +limit
    });

    res.json({ success: true, data: rows, meta: { total: count, page: +page, pages: Math.ceil(count / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET SINGLE REQUEST ── */
router.get('/:id', protect, async (req, res) => {
  try {
    const request = await Request.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Provider, as: 'provider', attributes: ['id','name','rating','phone','currentLat','currentLng'] },
        { model: User, as: 'user', attributes: ['id','name','phone'] }
      ]
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── UPDATE STATUS (provider/admin) ── */
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['assigned','enRoute','arrived','completed','cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });

    const updates = { status };
    if (status === 'completed') {
      updates.completedAt = new Date();
      await Provider.update({ isAvailable: true }, { where: { id: request.providerId } });
    }

    await request.update(updates);

    const io = req.app.get('io');
    io.to(`request:${request.id}`).emit('request:update', { requestId: request.id, status });

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── RATE REQUEST ── */
router.post('/:id/rate', protect, [
  body('rating').isInt({ min: 1, max: 5 }),
  body('feedback').optional().trim()
], async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const request = await Request.findOne({ where: { id: req.params.id, userId: req.user.id, status: 'completed' } });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found or not completed' });
    if (request.rating) return res.status(400).json({ success: false, message: 'Already rated' });

    await request.update({ rating, feedback });

    // Update provider average rating
    if (request.providerId) {
      const provider = await Provider.findByPk(request.providerId);
      const newRating = ((provider.rating * provider.totalJobs) + rating) / (provider.totalJobs + 1);
      await provider.update({ rating: Math.round(newRating * 10) / 10, totalJobs: provider.totalJobs + 1 });
    }

    res.json({ success: true, message: 'Rating submitted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
