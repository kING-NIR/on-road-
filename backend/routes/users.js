/* ============================================
   RoadAssist — routes/users.js
   ============================================ */
const router = require('express').Router();
const { User, Request } = require('../models');
const { protect } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

/* GET profile */
router.get('/profile', protect, async (req, res) => {
  try {
    const stats = await Request.findAll({
      where: { userId: req.user.id },
      attributes: ['status'],
      raw: true
    });
    const completed = stats.filter(r => r.status === 'completed').length;
    res.json({ success: true, data: { ...req.user.toJSON(), stats: { total: stats.length, completed } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* UPDATE profile */
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await req.user.update({ name, phone });
    res.json({ success: true, data: req.user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* CHANGE password */
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) return res.status(400).json({ success: false, message: 'Current password incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await user.update({ passwordHash: hash });
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
