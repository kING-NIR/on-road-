/* ============================================
   RoadAssist — routes/admin.js
   GET /api/admin/stats
   GET /api/admin/requests
   GET /api/admin/providers
   PATCH /api/admin/providers/:id/verify
   ============================================ */

const router = require('express').Router();
const { Op } = require('sequelize');
const { User, Provider, Request } = require('../models');
const { protect, requireRole } = require('../middleware/auth');

const adminOnly = [protect, requireRole('admin')];

/* ── DASHBOARD STATS ── */
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [totalUsers, totalProviders, totalRequests, completedToday, pending] = await Promise.all([
      User.count({ where: { role: 'user' } }),
      Provider.count(),
      Request.count(),
      Request.count({
        where: {
          status: 'completed',
          completedAt: { [Op.gte]: new Date(new Date().setHours(0,0,0,0)) }
        }
      }),
      Request.count({ where: { status: 'pending' } })
    ]);

    // Revenue estimate (demo)
    const avgServiceValue = 450;
    const estimatedRevenue = completedToday * avgServiceValue;

    res.json({
      success: true,
      data: { totalUsers, totalProviders, totalRequests, completedToday, pending, estimatedRevenue }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── LIST ALL REQUESTS ── */
router.get('/requests', ...adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, serviceType } = req.query;
    const where = {};
    if (status) where.status = status;
    if (serviceType) where.serviceType = serviceType;

    const { rows, count } = await Request.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['name','email','phone'] },
        { model: Provider, as: 'provider', attributes: ['name','phone','rating'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: +limit,
      offset: (+page - 1) * +limit
    });

    res.json({ success: true, data: rows, meta: { total: count, page: +page } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── LIST ALL PROVIDERS ── */
router.get('/providers', ...adminOnly, async (req, res) => {
  try {
    const providers = await Provider.findAll({
      include: [{ model: User, as: 'user', attributes: ['name','email'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── VERIFY PROVIDER ── */
router.patch('/providers/:id/verify', ...adminOnly, async (req, res) => {
  try {
    const provider = await Provider.findByPk(req.params.id);
    if (!provider) return res.status(404).json({ success: false, message: 'Not found' });
    await provider.update({ isVerified: true });
    res.json({ success: true, message: 'Provider verified' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── DELETE USER ── */
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    await User.update({ isActive: false }, { where: { id: req.params.id } });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
