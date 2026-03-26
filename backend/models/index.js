/* ============================================
   RoadAssist — models/index.js
   All Sequelize models + associations
   ============================================ */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/* ── USER MODEL ── */
const User = sequelize.define('User', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:         { type: DataTypes.STRING(100), allowNull: false },
  email:        { type: DataTypes.STRING(150), allowNull: false, unique: true },
  phone:        { type: DataTypes.STRING(20), allowNull: false },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  role:         { type: DataTypes.ENUM('user','provider','admin'), defaultValue: 'user' },
  fcmToken:     { type: DataTypes.STRING(255), allowNull: true },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
  avatarUrl:    { type: DataTypes.STRING(500), allowNull: true }
}, { tableName: 'users' });

/* ── SERVICE PROVIDER MODEL ── */
const Provider = sequelize.define('Provider', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  name:         { type: DataTypes.STRING(150), allowNull: false },
  serviceTypes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }, // ['fuel','mechanic']
  phone:        { type: DataTypes.STRING(20), allowNull: false },
  vehicleInfo:  { type: DataTypes.STRING(200), allowNull: true },
  rating:       { type: DataTypes.FLOAT, defaultValue: 5.0 },
  totalJobs:    { type: DataTypes.INTEGER, defaultValue: 0 },
  isAvailable:  { type: DataTypes.BOOLEAN, defaultValue: true },
  isVerified:   { type: DataTypes.BOOLEAN, defaultValue: false },
  currentLat:   { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  currentLng:   { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  coverageRadius:{ type: DataTypes.INTEGER, defaultValue: 20 } // km
}, { tableName: 'providers' });

/* ── SERVICE REQUEST MODEL ── */
const Request = sequelize.define('Request', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requestNumber:{ type: DataTypes.STRING(20), allowNull: false, unique: true },
  userId:       { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  providerId:   { type: DataTypes.UUID, allowNull: true, references: { model: 'providers', key: 'id' } },
  serviceType:  { type: DataTypes.ENUM('fuel','towing','mechanic','battery','tyre','sos'), allowNull: false },
  status:       { type: DataTypes.ENUM('pending','assigned','enRoute','arrived','completed','cancelled'), defaultValue: 'pending' },
  locationLat:  { type: DataTypes.DECIMAL(10, 8), allowNull: false },
  locationLng:  { type: DataTypes.DECIMAL(11, 8), allowNull: false },
  locationText: { type: DataTypes.STRING(500), allowNull: true },
  vehicleType:  { type: DataTypes.STRING(50), allowNull: true },
  vehicleNumber:{ type: DataTypes.STRING(20), allowNull: true },
  description:  { type: DataTypes.TEXT, allowNull: true },
  phone:        { type: DataTypes.STRING(20), allowNull: false },
  priority:     { type: DataTypes.ENUM('standard','high','critical'), defaultValue: 'standard' },
  estimatedETA: { type: DataTypes.INTEGER, allowNull: true }, // minutes
  completedAt:  { type: DataTypes.DATE, allowNull: true },
  totalAmount:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  rating:       { type: DataTypes.INTEGER, allowNull: true }, // 1-5
  feedback:     { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'requests' });

/* ── LOCATION LOG MODEL ── */
const LocationLog = sequelize.define('LocationLog', {
  id:         { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  providerId: { type: DataTypes.UUID, allowNull: false },
  requestId:  { type: DataTypes.UUID, allowNull: true },
  lat:        { type: DataTypes.DECIMAL(10, 8), allowNull: false },
  lng:        { type: DataTypes.DECIMAL(11, 8), allowNull: false },
  speed:      { type: DataTypes.FLOAT, allowNull: true },
  heading:    { type: DataTypes.FLOAT, allowNull: true }
}, { tableName: 'location_logs', updatedAt: false });

/* ── ASSOCIATIONS ── */
User.hasMany(Request, { foreignKey: 'userId', as: 'requests' });
Request.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Provider.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Provider, { foreignKey: 'userId', as: 'providerProfile' });

Request.belongsTo(Provider, { foreignKey: 'providerId', as: 'provider' });
Provider.hasMany(Request, { foreignKey: 'providerId', as: 'requests' });

module.exports = { User, Provider, Request, LocationLog, sequelize };
