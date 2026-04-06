/* ============================================
   RoadAssist — config/migrate.js
   Minimal "migration" runner.

   This project currently uses `sequelize.sync()`
   instead of Sequelize migrations.
   ============================================ */

require('dotenv').config();

const { sequelize } = require('./database');

(async () => {
  const alter = process.env.DB_SYNC_ALTER === 'true' || process.env.DB_SYNC_ALTER === '1';
  await sequelize.sync({ alter });
  console.log('✅ Database schema synced');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Migration failed:', err?.message || err);
  process.exit(1);
});

