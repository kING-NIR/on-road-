/* ============================================
   RoadAssist — config/database.js
   Sequelize + MySQL2 connection
   ============================================ */

const { Sequelize } = require('sequelize');
const mysql = require('mysql2/promise');

const DB_PASS = process.env.DB_PASS;
const dialect = process.env.DB_DIALECT || 'mysql';
if (dialect !== 'sqlite' && !DB_PASS) {
  throw new Error('DB_PASS is required for non-SQLite databases.');
}
if (DB_PASS === 'yourpassword' && dialect !== 'sqlite') {
  throw new Error('Update your dummy DB_PASS.');
}

const sequelize = new Sequelize(
  process.env.DB_NAME || 'roadassist_db',
  process.env.DB_USER || 'root',
  DB_PASS,
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    storage: process.env.DB_STORAGE, // for sqlite
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { timestamps: true, underscored: true, paranoid: true }
  }
);

async function ensureDatabaseExists() {
  const dbName = process.env.DB_NAME || 'roadassist_db';
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = DB_PASS;

  // Escape backticks to keep identifier safe.
  const escapedDbName = String(dbName).replace(/`/g, '``');

  const conn = await mysql.createConnection({ host, port, user, password });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${escapedDbName}\``);
  } finally {
    await conn.end();
  }
}

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connected via Sequelize');
  } catch (err) {
    const code = err?.original?.code || err?.parent?.code || err?.code;

    // If the DB doesn't exist yet, try creating it (credentials must allow CREATE).
    if (code === 'ER_BAD_DB_ERROR') {
      console.warn('⚠️ MySQL database missing; attempting CREATE DATABASE...');
      await ensureDatabaseExists();
      await sequelize.authenticate();
      console.log('✅ MySQL connected (after DB creation) via Sequelize');
      return;
    }

    console.error('❌ DB connection failed:', err.message);
    throw err;
  }
}

module.exports = { sequelize, connectDB };
