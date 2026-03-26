/* ============================================
   RoadAssist — utils/socketHandler.js
   All real-time Socket.IO events
   ============================================ */

const jwt = require('jsonwebtoken');
const { LocationLog } = require('../models');

module.exports = function socketHandler(io) {
  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(); // Allow anonymous for map page
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
    } catch { /* anonymous */ }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId || 'anon'})`);

    /* ── JOIN ROOMS ── */
    socket.on('join:request', ({ requestId }) => {
      socket.join(`request:${requestId}`);
      console.log(`Socket ${socket.id} joined request:${requestId}`);
    });

    socket.on('join:provider', ({ providerId }) => {
      socket.join(`provider:${providerId}`);
      console.log(`Socket ${socket.id} joined provider:${providerId}`);
    });

    socket.on('join:admin', () => {
      socket.join('admin');
    });

    /* ── PROVIDER BROADCASTS LOCATION ── */
    socket.on('location:update', async ({ providerId, lat, lng, speed, heading, requestId }) => {
      // Broadcast to all watching this provider / request
      socket.to(`request:${requestId}`).emit('provider:location', { providerId, lat, lng, speed, heading });
      socket.broadcast.emit('provider:location', { providerId, lat, lng });

      // Persist to DB (rate-limited by client — every 5s)
      try {
        await LocationLog.create({ providerId, requestId, lat, lng, speed, heading });
      } catch { /* non-critical */ }
    });

    /* ── REQUEST STATUS UPDATE ── */
    socket.on('request:status', ({ requestId, status, providerId }) => {
      io.to(`request:${requestId}`).emit('request:update', { requestId, status });
      io.to('admin').emit('admin:request:update', { requestId, status });
    });

    /* ── SEND NOTIFICATION ── */
    socket.on('notify:user', ({ userId, message, type }) => {
      io.to(`user:${userId}`).emit('notification', { message, type });
    });

    /* ── PING/PONG (connection health) ── */
    socket.on('ping', () => socket.emit('pong', { ts: Date.now() }));

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} — ${reason}`);
    });
  });
};
