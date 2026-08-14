const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  device_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Hardware Unique Serial
  },
  device_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  owner_phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  authorized_phone_1: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  authorized_phone_2: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  device_secret_key: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lock_reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  firmware_version: {
    type: DataTypes.STRING,
    defaultValue: '1.0.0',
  },
  last_ping: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true
});

module.exports = Device;
