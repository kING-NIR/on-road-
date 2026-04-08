/* ============================================
   RoadAssist — routes/auth.js
   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/me
   ============================================ */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { protect } = require('../middleware/auth');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

/* REGISTER */
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().withMessage('Phone required'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { name, email, phone, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, phone, passwordHash });

    const token = signToken(user.id);
    const { passwordHash: _, ...userData } = user.toJSON();
    res.status(201).json({ success: true, message: 'Account created', data: { token, user: userData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* LOGIN */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email, isActive: true } });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = signToken(user.id);
    const { passwordHash: _, ...userData } = user.toJSON();
    res.json({ success: true, data: { token, user: userData } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ME */
router.get('/me', protect, (req, res) => {
  res.json({ success: true, data: req.user });
});

/* UPDATE FCM TOKEN */
router.patch('/fcm-token', protect, async (req, res) => {
  const { fcmToken } = req.body;
  await req.user.update({ fcmToken });
  res.json({ success: true, message: 'FCM token updated' });
});

module.exports = router;
