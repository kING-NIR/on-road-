/* ============================================
   RoadAssist — server.js
   Express + Socket.IO Entry Point
   ============================================ */

const path    = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Set it in `backend/.env` (or Railway env vars).');
}
if (JWT_SECRET === 'your_super_secret_jwt_key_here_min_32_chars') {
  throw new Error(
    'JWT_SECRET is still set to the example placeholder. Update `backend/.env` (or Railway env vars) with a real random secret (>= 32 chars).'
  );
}

/* DB & Models */
const { sequelize, connectDB } = require('./config/database');

/* Routes */
const authRoutes     = require('./routes/auth');
const userRoutes     = require('./routes/users');
const requestRoutes  = require('./routes/requests');
const providerRoutes = require('./routes/providers');
const adminRoutes    = require('./routes/admin');
const configRoutes   = require('./routes/config');

/* Socket Handler */
const socketHandler = require('./utils/socketHandler');

const app = express();
const server = http.createServer(app);

/* ── SOCKET.IO ── */
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});
socketHandler(io);
app.set('io', io);

/* ── MIDDLEWARE ── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', /localhost:\d+/],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* Rate limiter */
const limiter = rateLimit({
  windowMs: +process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: +process.env.RATE_LIMIT_MAX || 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

/* ── SERVE FRONTEND (production) ── */
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
}

/* ── SERVE UPLOADED FILES ── */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ── API ROUTES ── */
app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/requests',  requestRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/config',    configRoutes);

/* Health check */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/* ── 404 & ERROR HANDLER ── */
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

/* ── START ── */
const PORT = process.env.PORT || 5000;
// Create tables on startup (safe by default); opt into destructive schema changes with `DB_SYNC_ALTER=true`.
connectDB()
  .then(() => sequelize.sync({ alter: process.env.DB_SYNC_ALTER === 'true' }))
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n🚀 RoadAssist server running on port ${PORT}`);
      console.log(`📡 Socket.IO ready`);
      console.log(`🌐 API: http://localhost:${PORT}/api`);
    });
  })
  .catch((err) => { console.error('DB connection/sync error:', err); process.exit(1); });

module.exports = { app, io };
