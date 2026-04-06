/* ============================================
   RoadAssist — config/seed.js
   Creates a default admin account (and one provider profile).
   ============================================ */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { User, Provider, sequelize } = require('../models');

(async () => {
  // Ensure tables exist before seeding.
  await sequelize.sync({ alter: false });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@roadassist.local';
  const adminName = process.env.SEED_ADMIN_NAME || 'RoadAssist Admin';
  const adminPhone = process.env.SEED_ADMIN_PHONE || '9999999999';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123456';

  const providerName = process.env.SEED_PROVIDER_NAME || 'Default Provider';
  const providerPhone = process.env.SEED_PROVIDER_PHONE || '8888888888';
  const providerVehicleInfo = process.env.SEED_PROVIDER_VEHICLE_INFO || 'Bike / Car';

  // Admin user
  let admin = await User.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    admin = await User.create({
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      passwordHash,
      role: 'admin',
      isActive: true
    });
    console.log(`✅ Seeded admin: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin already exists: ${adminEmail}`);
  }

  // Provider user + profile
  let providerUser = await User.findOne({ where: { email: 'provider@roadassist.local' } });
  if (!providerUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    providerUser = await User.create({
      name: providerName,
      email: 'provider@roadassist.local',
      phone: providerPhone,
      passwordHash,
      role: 'provider',
      isActive: true
    });
  }

  const providerProfile = await Provider.findOne({ where: { userId: providerUser.id } });
  if (!providerProfile) {
    await Provider.create({
      userId: providerUser.id,
      name: providerName,
      phone: providerPhone,
      vehicleInfo: providerVehicleInfo,
      serviceTypes: ['fuel']
    });
    console.log('✅ Seeded provider profile');
  } else {
    console.log('ℹ️ Provider profile already exists');
  }

  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed failed:', err?.message || err);
  process.exit(1);
});

